import { SystemConfig } from '../models/SystemConfig.js';
import { UsageLog } from '../models/UsageLog.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

function getDefaultMode() {
  if (process.env.NODE_ENV === 'test') {
    return 'credit_strict';
  }
  return env.CREDIT_ENFORCEMENT_MODE || 'quota_free';
}

function getDefaultQuota() {
  return 1500;
}

// In-memory cache for ultra-fast, zero-latency synchronous checks in middleware
let cachedConfig = {
  billingEnforcementMode: getDefaultMode(),
  dailyGeminiQuotaLimit: getDefaultQuota(),
  updatedBy: null,
  updatedAt: new Date(),
};

/**
 * Returns the UTC start of today (00:00:00.000 UTC) matching Google's billing cycle.
 */
function getTodayStartUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

export const systemConfigService = {
  /**
   * Retrieves current system governance config from DB, upserting default if not found.
   */
  async getConfig() {
    try {
      let config = await SystemConfig.findById('global_config').lean();

      if (!config) {
        config = await SystemConfig.create({
          _id: 'global_config',
          billingEnforcementMode: getDefaultMode(),
          dailyGeminiQuotaLimit: getDefaultQuota(),
        });
      }

      cachedConfig = {
        billingEnforcementMode: config.billingEnforcementMode || 'quota_free',
        dailyGeminiQuotaLimit: config.dailyGeminiQuotaLimit || getDefaultQuota(),
        updatedBy: config.updatedBy || null,
        updatedAt: config.updatedAt || new Date(),
      };

      return config;
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to fetch SystemConfig from DB; using cache');
      return cachedConfig;
    }
  },

  /**
   * Updates billingEnforcementMode and/or dailyGeminiQuotaLimit.
   */
  async updateConfig({ billingEnforcementMode, dailyGeminiQuotaLimit, updatedBy }) {
    if (
      billingEnforcementMode &&
      !['quota_free', 'credit_strict'].includes(billingEnforcementMode)
    ) {
      throw new ApiError(
        400,
        'INVALID_ENFORCEMENT_MODE',
        "billingEnforcementMode must be either 'quota_free' or 'credit_strict'",
      );
    }

    const updateFields = {
      updatedAt: new Date(),
    };
    if (billingEnforcementMode) {
      updateFields.billingEnforcementMode = billingEnforcementMode;
    }
    if (typeof dailyGeminiQuotaLimit === 'number' && dailyGeminiQuotaLimit > 0) {
      updateFields.dailyGeminiQuotaLimit = dailyGeminiQuotaLimit;
    }
    if (updatedBy) {
      updateFields.updatedBy = updatedBy;
    }

    const config = await SystemConfig.findByIdAndUpdate(
      'global_config',
      { $set: updateFields },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    cachedConfig = {
      billingEnforcementMode: config.billingEnforcementMode || 'quota_free',
      dailyGeminiQuotaLimit: config.dailyGeminiQuotaLimit || getDefaultQuota(),
      updatedBy: config.updatedBy || null,
      updatedAt: config.updatedAt || new Date(),
    };

    logger.info(
      {
        billingEnforcementMode: config.billingEnforcementMode,
        dailyGeminiQuotaLimit: config.dailyGeminiQuotaLimit,
        updatedBy,
      },
      'Platform governance configuration updated',
    );

    return config;
  },

  /**
   * Returns current active enforcement mode.
   * Prioritizes in-memory cache for 0ms middleware response.
   */
  getBillingMode() {
    return (
      cachedConfig?.billingEnforcementMode ||
      env.CREDIT_ENFORCEMENT_MODE ||
      (env.NODE_ENV === 'test' ? 'credit_strict' : 'quota_free')
    );
  },

  /**
   * Checks if requests executed today (since 00:00 UTC) have exceeded the daily Gemini quota limit.
   */
  async checkDailyQuota() {
    const todayStart = getTodayStartUTC();
    const limit = cachedConfig.dailyGeminiQuotaLimit || getDefaultQuota();

    const requestsToday = await UsageLog.countDocuments({
      createdAt: { $gte: todayStart },
    });

    return {
      allowed: requestsToday < limit,
      requestsToday,
      limit,
      remaining: Math.max(0, limit - requestsToday),
    };
  },

  /**
   * Computes real-time live Google Gemini API free-tier telemetry metrics:
   * 1. Daily Quota Progress: Requests Today / 1,500 RPD
   * 2. Rate Monitoring: Live RPM (15 limit) and TPM (1,000,000 limit)
   * 3. Daily Token Breakdown: Input vs Output tokens, Flash vs Pro model distribution
   */
  async getGeminiTelemetry() {
    const todayStart = getTodayStartUTC();
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const dailyLimit = cachedConfig.dailyGeminiQuotaLimit || 1500;
    const rpmLimit = 15;
    const tpmLimit = 1000000;

    const [requestsToday, todayTokenAgg, rpmCount, tpmAgg] = await Promise.all([
      UsageLog.countDocuments({ createdAt: { $gte: todayStart } }),
      UsageLog.aggregate([
        { $match: { createdAt: { $gte: todayStart } } },
        {
          $group: {
            _id: null,
            totalTokens: { $sum: '$tokensUsed' },
            flashTokens: {
              $sum: { $cond: [{ $eq: ['$model', 'flash'] }, '$tokensUsed', 0] },
            },
            proTokens: {
              $sum: { $cond: [{ $eq: ['$model', 'pro'] }, '$tokensUsed', 0] },
            },
          },
        },
      ]),
      UsageLog.countDocuments({ createdAt: { $gte: oneMinuteAgo } }),
      UsageLog.aggregate([
        { $match: { createdAt: { $gte: oneMinuteAgo } } },
        {
          $group: {
            _id: null,
            totalTokens: { $sum: '$tokensUsed' },
          },
        },
      ]),
    ]);

    const totalTokensToday = todayTokenAgg[0]?.totalTokens || 0;
    const flashTokensToday = todayTokenAgg[0]?.flashTokens || 0;
    const proTokensToday = todayTokenAgg[0]?.proTokens || 0;
    const currentTpm = tpmAgg[0]?.totalTokens || 0;

    // Estimate input vs output tokens based on standard conversational ratio (40% prompt / 60% candidate)
    const inputTokens = Math.round(totalTokensToday * 0.4);
    const outputTokens = totalTokensToday - inputTokens;

    const requestsRemaining = Math.max(0, dailyLimit - requestsToday);
    const quotaUsedPercentage =
      dailyLimit > 0 ? Number(((requestsToday / dailyLimit) * 100).toFixed(1)) : 0;

    return {
      dailyLimit,
      requestsToday,
      requestsRemaining,
      quotaUsedPercentage,
      rpm: rpmCount,
      rpmLimit,
      tpm: currentTpm,
      tpmLimit,
      activeModel: env.GEMINI_FLASH_MODEL || 'gemini-3.5-flash-lite',
      tokensToday: {
        total: totalTokensToday,
        inputTokens,
        outputTokens,
        flashTokens: flashTokensToday,
        proTokens: proTokensToday,
        avgTokensPerRequest: requestsToday > 0 ? Math.round(totalTokensToday / requestsToday) : 0,
        activeModel: env.GEMINI_FLASH_MODEL || 'gemini-3.5-flash-lite',
      },
      resetTimeUTC: '00:00 UTC',
    };
  },

  /**
   * Returns a sanitized, lightweight governance summary for public/user endpoints.
   */
  async getPublicGovernanceStatus() {
    const todayStart = getTodayStartUTC();
    const limit = cachedConfig.dailyGeminiQuotaLimit || 1500;

    let requestsToday = 0;
    try {
      requestsToday = await UsageLog.countDocuments({
        createdAt: { $gte: todayStart },
      });
    } catch {
      requestsToday = 0;
    }

    return {
      billingEnforcementMode: this.getBillingMode(),
      dailyGeminiQuotaLimit: limit,
      dailyRequestsUsed: requestsToday,
      dailyRequestsRemaining: Math.max(0, limit - requestsToday),
    };
  },
};

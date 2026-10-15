import { ApiError } from '../utils/ApiError.js';
import { systemConfigService } from '../services/systemConfig.service.js';

/**
 * Middleware that enforces access governance across Dual-Mode Billing tiers:
 * - When creditsRemaining > 0: Permits request immediately.
 * - When mode is 'quota_free': Bypasses 402 gate and verifies total platform calls remain within the daily Gemini API quota ceiling (default: 50,000 req/day).
 * - When mode is 'credit_strict': Strictly enforces wallet balance and rejects zero-balance requests with HTTP 402 INSUFFICIENT_CREDITS.
 * - Exempts free-tier operations (isSimulation, Edge Neural TTS).
 */
export function creditCheck(req, _res, next) {
  try {
    if (!req.user) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required for credit check');
    }

    // Allow mock interview simulation or Edge Neural TTS (0 credits, free tier) without deducting credits
    if (
      req.body?.isSimulation === true ||
      req.query?.simulation === 'true' ||
      req.headers?.['x-simulation'] === 'true' ||
      req.body?.engine === 'edge'
    ) {
      return next();
    }

    const creditsRemaining = req.user.wallet?.creditsRemaining ?? 0;

    // When balance is positive, permit immediately and synchronously
    if (creditsRemaining > 0) {
      return next();
    }

    // Check active enforcement mode (defaults to quota_free in app/dev/prod)
    const mode = systemConfigService.getBillingMode();

    if (mode === 'quota_free') {
      // In quota-free mode, verify that platform daily calls remain under the daily quota ceiling
      return systemConfigService
        .checkDailyQuota()
        .then((quotaCheck) => {
          if (!quotaCheck.allowed) {
            return next(
              new ApiError(
                429,
                'DAILY_QUOTA_EXCEEDED',
                `Daily Gemini API quota limit of ${quotaCheck.limit} requests reached. Resets at 00:00 UTC.`,
              ),
            );
          }
          next();
        })
        .catch(next);
    }

    // Strict mode (used in test suite): require positive balance
    if (creditsRemaining <= 0) {
      throw new ApiError(402, 'INSUFFICIENT_CREDITS', 'Recharge to continue');
    }

    next();
  } catch (error) {
    next(error);
  }
}

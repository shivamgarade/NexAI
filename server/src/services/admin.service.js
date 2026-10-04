import { UsageLog } from '../models/UsageLog.js';
import { User } from '../models/User.js';
import { Transaction } from '../models/Transaction.js';
import { ErrorLog } from '../models/ErrorLog.js';
import { env } from '../config/env.js';

export const adminService = {
  /**
   * Aggregates platform-wide KPI stats.
   */
  async getPlatformStats() {
    const [tokenStats, revenueStats, activeUsersCount, totalErrorsCount] = await Promise.all([
      UsageLog.aggregate([
        {
          $group: {
            _id: null,
            totalTokens: { $sum: '$tokensUsed' },
            totalCreditsDeducted: { $sum: '$creditsDeducted' },
            count: { $sum: 1 },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: { status: 'success' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amountINR' },
            totalCreditsAdded: { $sum: '$creditsAdded' },
            totalTransactions: { $sum: 1 },
          },
        },
      ]),
      User.countDocuments(),
      ErrorLog.countDocuments(),
    ]);

    const totalTokens = tokenStats[0]?.totalTokens || 0;
    const totalCreditsDeducted = tokenStats[0]?.totalCreditsDeducted || 0;
    const usageCallCount = tokenStats[0]?.count || 0;
    const totalRevenue = revenueStats[0]?.totalRevenue || 0;
    const totalCreditsAdded = revenueStats[0]?.totalCreditsAdded || 0;
    const successfulTransactions = revenueStats[0]?.totalTransactions || 0;

    return {
      totalTokens,
      totalCreditsDeducted,
      activeUsers: activeUsersCount,
      totalRevenue,
      totalCreditsAdded,
      successfulTransactions,
      totalErrors: totalErrorsCount,
      usageCallCount,
    };
  },

  /**
   * Aggregates daily usage time-series and model distribution split.
   * @param {'7d' | '30d'} range
   */
  async getUsageTimeSeries(range = '7d') {
    const days = range === '30d' ? 30 : 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (days - 1));
    cutoffDate.setHours(0, 0, 0, 0);

    const [dailyAgg, modelAgg, featureAgg] = await Promise.all([
      UsageLog.aggregate([
        { $match: { createdAt: { $gte: cutoffDate } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            totalTokens: { $sum: '$tokensUsed' },
            flashTokens: {
              $sum: {
                $cond: [{ $eq: ['$model', 'flash'] }, '$tokensUsed', 0],
              },
            },
            proTokens: {
              $sum: {
                $cond: [{ $eq: ['$model', 'pro'] }, '$tokensUsed', 0],
              },
            },
            requestCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      UsageLog.aggregate([
        { $match: { createdAt: { $gte: cutoffDate } } },
        {
          $group: {
            _id: '$model',
            tokens: { $sum: '$tokensUsed' },
            count: { $sum: 1 },
          },
        },
      ]),

      UsageLog.aggregate([
        { $match: { createdAt: { $gte: cutoffDate } } },
        {
          $group: {
            _id: '$feature',
            tokens: { $sum: '$tokensUsed' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Fill in missing dates in the time-series with zero tokens
    const dateMap = new Map();
    for (let i = 0; i < days; i++) {
      const d = new Date(cutoffDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dateMap.set(key, {
        date: key,
        totalTokens: 0,
        flashTokens: 0,
        proTokens: 0,
        requestCount: 0,
      });
    }

    for (const item of dailyAgg) {
      if (dateMap.has(item._id)) {
        dateMap.set(item._id, {
          date: item._id,
          totalTokens: item.totalTokens,
          flashTokens: item.flashTokens,
          proTokens: item.proTokens,
          requestCount: item.requestCount,
        });
      }
    }

    const timeSeries = Array.from(dateMap.values());

    // Process model split
    let flashTokens = 0;
    let proTokens = 0;
    let flashCount = 0;
    let proCount = 0;

    for (const m of modelAgg) {
      if (m._id === 'flash') {
        flashTokens = m.tokens;
        flashCount = m.count;
      } else if (m._id === 'pro') {
        proTokens = m.tokens;
        proCount = m.count;
      }
    }

    const totalModelTokens = flashTokens + proTokens;
    const modelSplit = [
      {
        name: 'Gemini Flash',
        model: 'flash',
        tokens: flashTokens,
        count: flashCount,
        percentage: totalModelTokens > 0 ? Math.round((flashTokens / totalModelTokens) * 100) : 0,
      },
      {
        name: 'Gemini Pro',
        model: 'pro',
        tokens: proTokens,
        count: proCount,
        percentage: totalModelTokens > 0 ? Math.round((proTokens / totalModelTokens) * 100) : 0,
      },
    ];

    const featureSplit = featureAgg.map((f) => ({
      feature: f._id || 'general',
      tokens: f.tokens,
      count: f.count,
    }));

    return {
      range,
      activeModel: env.GEMINI_FLASH_MODEL || 'gemini-3.5-flash-lite',
      timeSeries,
      modelSplit,
      featureSplit,
      summary: {
        totalTokens: totalModelTokens,
        flashTokens,
        proTokens,
      },
    };
  },

  /**
   * Paginated list of all platform recharges.
   */
  async getAdminTransactions({ page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'email role')
        .lean(),
      Transaction.countDocuments(),
    ]);

    return {
      transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  /**
   * Paginated list from ErrorLog collection.
   */
  async getAdminErrors({ page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;

    const [errors, total] = await Promise.all([
      ErrorLog.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'email')
        .lean(),
      ErrorLog.countDocuments(),
    ]);

    return {
      errors,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },
};

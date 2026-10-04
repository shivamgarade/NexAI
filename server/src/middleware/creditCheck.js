import { ApiError } from '../utils/ApiError.js';
import { systemConfigService } from '../services/systemConfig.service.js';

/**
 * Middleware that governs access based on active daily request quota (default: 50,000 requests/day):
 * - Checks that daily requests have not exceeded the daily quota ceiling.
 * - Does not block with 402 INSUFFICIENT_CREDITS or require recharge,
 *   as subscription/recharge plans are for demonstration / future scope.
 */
export function creditCheck(req, _res, next) {
  try {
    if (!req.user) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required for credit check');
    }

    // Allow mock interview simulation without deducting credits if simulation mode is flagged
    if (
      req.body?.isSimulation === true ||
      req.query?.simulation === 'true' ||
      req.headers?.['x-simulation'] === 'true'
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

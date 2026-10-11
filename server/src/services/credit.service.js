import { User } from '../models/User.js';
import { UsageLog } from '../models/UsageLog.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { systemConfigService } from './systemConfig.service.js';

/**
 * Calculates credit cost from token count based on env configuration.
 * credits = Math.ceil(totalTokens / 100) * CREDITS_PER_100_TOKENS
 *
 * @param {number} tokens - Total tokens consumed (input + output)
 * @returns {number} Credits to deduct
 */
export function tokensToCredits(tokens) {
  if (!tokens || tokens <= 0) return 0;
  const multiplier = env.CREDITS_PER_100_TOKENS || 1;
  return Math.ceil(tokens / 100) * multiplier;
}

/**
 * Asserts that a user has a positive credit balance.
 * Throws 402 INSUFFICIENT_CREDITS if creditsRemaining <= 0 in credit_strict mode.
 * Bypasses 402 if billingEnforcementMode is 'quota_free'.
 *
 * @param {string} userId - User ID to check
 * @returns {Promise<number>} Current credit balance
 */
export async function assertBalance(userId) {
  const user = await User.findById(userId).select('wallet');
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const creditsRemaining = user.wallet?.creditsRemaining ?? 0;
  if (creditsRemaining > 0) {
    return creditsRemaining;
  }

  const mode = systemConfigService.getBillingMode();
  if (mode === 'quota_free') {
    return creditsRemaining;
  }

  throw new ApiError(402, 'INSUFFICIENT_CREDITS', 'Recharge to continue');
}

/**
 * Atomically deducts credits from a user's wallet and logs usage.
 * creditsRemaining will never drop below 0.
 *
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {number} params.tokensUsed - Total token count
 * @param {'chat' | 'library' | 'docgen'} params.feature - Feature being used
 * @param {'flash' | 'pro'} params.model - Model used
 * @returns {Promise<{ creditsDeducted: number, creditsRemaining: number, totalTokensConsumed: number, usageLogId: string }>}
 */
export async function deductCredits({ userId, tokensUsed, feature, model }) {
  const creditsDeducted = tokensToCredits(tokensUsed);
  const normalizedModel = model === 'pro' ? 'pro' : model === 'tts' ? 'tts' : 'flash';

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    [
      {
        $set: {
          'wallet.creditsRemaining': {
            $max: [0, { $subtract: ['$wallet.creditsRemaining', creditsDeducted] }],
          },
          'wallet.totalTokensConsumed': {
            $add: ['$wallet.totalTokensConsumed', tokensUsed || 0],
          },
        },
      },
    ],
    { new: true },
  );

  if (!updatedUser) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found during credit deduction');
  }

  const usageLog = await UsageLog.create({
    userId,
    model: normalizedModel,
    feature,
    tokensUsed: tokensUsed || 0,
    creditsDeducted,
  });

  return {
    creditsDeducted,
    creditsRemaining: updatedUser.wallet.creditsRemaining,
    totalTokensConsumed: updatedUser.wallet.totalTokensConsumed,
    usageLogId: usageLog._id.toString(),
  };
}

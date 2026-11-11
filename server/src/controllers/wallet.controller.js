import { PLANS } from '../config/plans.js';
import { Transaction } from '../models/Transaction.js';
import { User } from '../models/User.js';
import * as razorpayService from '../services/razorpay.service.js';
import { systemConfigService } from '../services/systemConfig.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * GET /api/wallet
 * Returns current user wallet credits, tier, token consumption, and active quota governance status.
 */
export const getWallet = asyncHandler(async (req, res) => {
  const [user, governance] = await Promise.all([
    User.findById(req.user._id).select('wallet'),
    systemConfigService.getPublicGovernanceStatus(),
  ]);

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User profile not found');
  }

  res.status(200).json({
    data: {
      wallet: user.wallet || {
        creditsRemaining: 0,
        tier: 'free',
        totalTokensConsumed: 0,
      },
      governance,
    },
  });
});

/**
 * GET /api/wallet/plans
 * Returns available recharge plans strictly from server configuration.
 */
export const getPlans = asyncHandler(async (req, res) => {
  res.status(200).json({
    data: {
      plans: PLANS,
    },
  });
});

/**
 * POST /api/wallet/orders
 * Creates an order on Razorpay and records pending transaction in ledger.
 */
export const createOrder = asyncHandler(async (req, res) => {
  const { planId } = req.body;
  const order = await razorpayService.createOrder({
    planId,
    userId: req.user._id,
  });

  res.status(201).json({
    data: order,
  });
});

/**
 * POST /api/wallet/verify
 * Verifies Razorpay checkout HMAC signature and credits wallet idempotently.
 */
export const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const isValid = razorpayService.verifyPaymentSignature({
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  if (!isValid) {
    throw new ApiError(400, 'INVALID_SIGNATURE', 'Payment signature verification failed');
  }

  const result = await razorpayService.processSuccessfulPayment({
    paymentId: razorpay_payment_id,
    orderId: razorpay_order_id,
    userId: req.user._id,
    source: 'verify',
  });

  res.status(200).json({
    data: {
      success: true,
      credited: result.credited,
      alreadyProcessed: result.alreadyProcessed,
      creditsRemaining: result.creditsRemaining,
      transaction: result.transaction,
    },
  });
});

/**
 * GET /api/wallet/transactions
 * Returns paginated transaction history for the authenticated user.
 */
export const getTransactions = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const query = { userId: req.user._id };

  const [transactions, total] = await Promise.all([
    Transaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Transaction.countDocuments(query),
  ]);

  res.status(200).json({
    data: {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    },
  });
});

/**
 * PATCH /api/wallet/mode
 * Updates the active billing enforcement mode (quota_free vs credit_strict).
 * Accessible to all authenticated users for seamless academic and viva demonstration.
 */
export const updateGovernanceMode = asyncHandler(async (req, res) => {
  const { billingEnforcementMode } = req.body;
  const config = await systemConfigService.updateConfig({
    billingEnforcementMode,
    updatedBy: req.user._id,
  });
  const governance = await systemConfigService.getPublicGovernanceStatus();
  res.status(200).json({
    data: {
      billingEnforcementMode: config.billingEnforcementMode,
      governance,
    },
  });
});

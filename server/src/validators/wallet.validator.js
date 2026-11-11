import { z } from 'zod';
import { PLANS } from '../config/plans.js';

const validPlanIds = PLANS.map((p) => p.id);

export const createOrderSchema = z.object({
  planId: z
    .string({ required_error: 'Plan ID is required' })
    .trim()
    .refine((val) => validPlanIds.includes(val), {
      message: `Invalid plan ID. Must be one of: ${validPlanIds.join(', ')}`,
    }),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z
    .string({ required_error: 'Razorpay order ID is required' })
    .trim()
    .min(1, 'Order ID cannot be empty'),
  razorpay_payment_id: z
    .string({ required_error: 'Razorpay payment ID is required' })
    .trim()
    .min(1, 'Payment ID cannot be empty'),
  razorpay_signature: z
    .string({ required_error: 'Razorpay signature is required' })
    .trim()
    .min(1, 'Signature cannot be empty'),
});

export const getTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const updateGovernanceModeSchema = z.object({
  billingEnforcementMode: z.enum(['quota_free', 'credit_strict'], {
    required_error: 'billingEnforcementMode must be either quota_free or credit_strict',
  }),
});

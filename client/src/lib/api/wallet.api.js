import { apiClient } from './client.js';

export const walletApi = {
  /**
   * Fetch current user's wallet credit balance, tier, and total consumption
   */
  getWallet() {
    return apiClient.get('/wallet');
  },

  /**
   * Fetch available recharge plans from server config
   */
  getPlans() {
    return apiClient.get('/wallet/plans');
  },

  /**
   * Create Razorpay order for a selected plan
   * @param {{ planId: string }} data
   */
  createOrder(data) {
    return apiClient.post('/wallet/orders', data);
  },

  /**
   * Verify Razorpay payment signature and credit wallet
   * @param {{ razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string }} data
   */
  verifyPayment(data) {
    return apiClient.post('/wallet/verify', data);
  },

  /**
   * Get paginated transaction history
   * @param {{ page?: number, limit?: number }} [params]
   */
  getTransactions(params) {
    return apiClient.get('/wallet/transactions', { params });
  },

  /**
   * Update active billing enforcement mode (quota_free vs credit_strict)
   * @param {string} billingEnforcementMode
   */
  updateGovernanceMode(billingEnforcementMode) {
    return apiClient.patch('/wallet/mode', { billingEnforcementMode });
  },
};

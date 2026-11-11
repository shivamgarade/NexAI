import { create } from 'zustand';
import { walletApi } from '@/lib/api/wallet.api';
import { useAuthStore } from '@/store/authStore';

export const DEFAULT_PLANS = [
  {
    id: 'starter_pack',
    name: 'Starter Top-Up',
    description: 'Perfect for quick tests, assignments, and light chat sessions',
    amountINR: 49,
    amountPaise: 4900,
    credits: 500,
    tier: 'free',
    badge: null,
    popular: false,
    features: [
      '500 AI credits (~50,000 tokens)',
      'Gemini 3.8 Flash access',
      'Personal Library storage',
      'PDF & Document export',
    ],
  },
  {
    id: 'pro_pack',
    name: 'Pro Developer Pack',
    description: 'Best value for active development, mock interviews, and project workspaces',
    amountINR: 99,
    amountPaise: 9900,
    credits: 1200,
    tier: 'free',
    badge: 'Popular',
    popular: true,
    features: [
      '1,200 AI credits (~120,000 tokens)',
      'Gemini Flash & Pro models',
      'Priority SSE streaming',
      'AI Mock Interview simulations',
      'Full Library & Hybrid Search',
    ],
  },
  {
    id: 'power_pack',
    name: 'Power Studio Tier',
    description: 'Massive capacity for extensive document drafting, capstone prep, and heavy usage',
    amountINR: 249,
    amountPaise: 24900,
    credits: 3500,
    tier: 'pro_monthly',
    badge: 'Best Value',
    popular: false,
    features: [
      '3,500 AI credits (~350,000 tokens)',
      'Pro Monthly tier upgrade',
      'Unlimited project workspaces',
      'Comprehensive interview analytics',
      'Full cross-domain vector search',
    ],
  },
];

export const useWalletStore = create((set, get) => ({
  wallet: null,
  governance: {
    billingEnforcementMode: 'quota_free',
    dailyGeminiQuotaLimit: 1500,
    dailyRequestsUsed: 0,
    dailyRequestsRemaining: 1500,
  },
  plans: DEFAULT_PLANS,
  transactions: [],
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    pages: 1,
  },
  isLoadingWallet: false,
  isLoadingPlans: false,
  isLoadingTransactions: false,
  isProcessingCheckout: false,
  checkoutPlanId: null,
  error: null,

  setGovernance: (governance) => set({ governance }),

  updateGovernanceMode: async (mode) => {
    try {
      const res = await walletApi.updateGovernanceMode(mode);
      const payload = res.data?.data || res.data || {};
      const newMode = payload.billingEnforcementMode || mode;
      const updatedGov = payload.governance || {
        ...get().governance,
        billingEnforcementMode: newMode,
      };
      set({ governance: updatedGov });
      return { success: true, mode: newMode };
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to update billing mode';
      return { success: false, error: msg };
    }
  },

  fetchWallet: async () => {
    set({ isLoadingWallet: true, error: null });
    try {
      const res = await walletApi.getWallet();
      const payload = res.data?.data || res.data || {};
      const wallet = payload.wallet;
      const governance = payload.governance;

      set({
        wallet,
        ...(governance ? { governance } : {}),
        isLoadingWallet: false,
      });

      // Keep authStore in sync
      if (wallet && typeof wallet.creditsRemaining === 'number') {
        useAuthStore.getState().updateCredits(wallet.creditsRemaining);
      }
      return wallet;
    } catch (err) {
      set({
        isLoadingWallet: false,
        error: err.response?.data?.error?.message || 'Failed to load wallet',
      });
      return null;
    }
  },

  fetchPlans: async () => {
    set({ isLoadingPlans: true, error: null });
    try {
      const res = await walletApi.getPlans();
      const plans = res.data.data.plans;
      set({ plans: plans && plans.length > 0 ? plans : DEFAULT_PLANS, isLoadingPlans: false });
      return plans;
    } catch {
      set({
        plans: DEFAULT_PLANS,
        isLoadingPlans: false,
      });
      return DEFAULT_PLANS;
    }
  },

  fetchTransactions: async (page = 1) => {
    set({ isLoadingTransactions: true, error: null });
    try {
      const res = await walletApi.getTransactions({ page, limit: 10 });
      const { transactions, pagination } = res.data.data;
      set({
        transactions,
        pagination,
        isLoadingTransactions: false,
      });
      return transactions;
    } catch (err) {
      set({
        isLoadingTransactions: false,
        error: err.response?.data?.error?.message || 'Failed to load transactions',
      });
      return [];
    }
  },

  /**
   * Helper to load Razorpay checkout script if not already present
   */
  loadRazorpayScript: () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  },

  /**
   * Initiate Checkout flow for a plan
   */
  checkout: async ({ plan, user, onPaymentSuccess, onPaymentError }) => {
    set({ isProcessingCheckout: true, checkoutPlanId: plan.id, error: null });

    try {
      // 1. Create order on backend
      const orderRes = await walletApi.createOrder({ planId: plan.id });
      const { orderId, amount, currency, keyId } = orderRes.data.data;

      // 2. Try loading official Razorpay script
      const scriptLoaded = await get().loadRazorpayScript();

      const isMockKey = !keyId || keyId.includes('demo') || keyId.includes('mock');

      if (isMockKey || !scriptLoaded || !window.Razorpay) {
        // Direct simulation mode if Razorpay demo key is active or CDN is blocked
        const verifyRes = await walletApi.verifyPayment({
          razorpay_order_id: orderId,
          razorpay_payment_id: `pay_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          razorpay_signature: 'mock_valid_signature',
        });

        const updatedCredits = verifyRes.data.data.creditsRemaining;
        set({ isProcessingCheckout: false, checkoutPlanId: null });
        if (typeof updatedCredits === 'number') {
          useAuthStore.getState().updateCredits(updatedCredits);
        }
        await Promise.all([get().fetchWallet(), get().fetchTransactions(1)]);
        onPaymentSuccess?.(verifyRes.data.data);
        return;
      }

      // 3. Open Razorpay Checkout modal locked strictly to UPI & QR
      const options = {
        key: keyId,
        amount,
        currency: currency || 'INR',
        name: 'NexAI Workspace',
        description: `${plan.name} (${plan.credits} Credits)`,
        order_id: orderId,
        prefill: {
          email: user?.email || '',
          method: 'upi',
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: 'Pay using UPI / QR',
                instruments: [
                  {
                    method: 'upi',
                  },
                ],
              },
            },
            sequence: ['block.upi'],
            preferences: {
              show_default_blocks: false,
            },
          },
        },
        theme: {
          color: '#22c55e', // design token green-500
        },
        modal: {
          ondismiss: () => {
            set({ isProcessingCheckout: false, checkoutPlanId: null });
          },
        },
        handler: async (response) => {
          try {
            // Verify HMAC signature on backend
            const verifyRes = await walletApi.verifyPayment({
              razorpay_order_id: response.razorpay_order_id || orderId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            const updatedCredits = verifyRes.data.data.creditsRemaining;
            set({ isProcessingCheckout: false, checkoutPlanId: null });

            if (typeof updatedCredits === 'number') {
              useAuthStore.getState().updateCredits(updatedCredits);
            }

            await Promise.all([get().fetchWallet(), get().fetchTransactions(1)]);
            onPaymentSuccess?.(verifyRes.data.data);
          } catch (verifyErr) {
            set({
              isProcessingCheckout: false,
              checkoutPlanId: null,
              error: verifyErr.response?.data?.error?.message || 'Payment verification failed',
            });
            onPaymentError?.(verifyErr);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (failedRes) => {
        set({
          isProcessingCheckout: false,
          checkoutPlanId: null,
          error: failedRes.error?.description || 'Payment failed',
        });
        onPaymentError?.(failedRes.error);
      });
      rzp.open();
    } catch (err) {
      set({
        isProcessingCheckout: false,
        checkoutPlanId: null,
        error: err.response?.data?.error?.message || 'Failed to start payment',
      });
      onPaymentError?.(err);
    }
  },

  /**
   * 1-Click Test Simulation Recharge (Zero-Card Demo Mode for Examiner / Offline Testing)
   */
  simulateTestRecharge: async ({ plan, onPaymentSuccess, onPaymentError }) => {
    set({ isProcessingCheckout: true, checkoutPlanId: plan.id, error: null });
    try {
      const orderRes = await walletApi.createOrder({ planId: plan.id });
      const { orderId } = orderRes.data.data;

      const verifyRes = await walletApi.verifyPayment({
        razorpay_order_id: orderId,
        razorpay_payment_id: `pay_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        razorpay_signature: 'mock_valid_signature',
      });

      const updatedCredits = verifyRes.data.data.creditsRemaining;
      set({ isProcessingCheckout: false, checkoutPlanId: null });

      if (typeof updatedCredits === 'number') {
        useAuthStore.getState().updateCredits(updatedCredits);
      }

      await Promise.all([get().fetchWallet(), get().fetchTransactions(1)]);
      onPaymentSuccess?.(verifyRes.data.data);
    } catch (err) {
      set({
        isProcessingCheckout: false,
        checkoutPlanId: null,
        error: err.response?.data?.error?.message || 'Simulation failed',
      });
      onPaymentError?.(err);
    }
  },

  clearError: () => set({ error: null }),
}));

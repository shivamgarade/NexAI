import { useEffect, useState, useCallback } from 'react';
import {
  Wallet,
  Zap,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Crown,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  PlanCard,
  TransactionTable,
  RazorpayPaymentModal,
} from '@/features/wallet';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import styles from './WalletPage.module.scss';

export default function WalletPage() {
  const user = useAuthStore((state) => state.user);

  const {
    wallet,
    plans,
    transactions,
    pagination,
    isLoadingTransactions,
    isProcessingCheckout,
    error,
    clearError,
    fetchWallet,
    fetchPlans,
    fetchTransactions,
    simulateTestRecharge,
  } = useWalletStore();

  const [notification, setNotification] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeCheckoutPlan, setActiveCheckoutPlan] = useState(null);

  const loadAllData = useCallback(async () => {
    await Promise.all([fetchWallet(), fetchPlans(), fetchTransactions(1)]);
  }, [fetchWallet, fetchPlans, fetchTransactions]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleManualSync = async () => {
    setIsRefreshing(true);
    clearError();
    await loadAllData();
    setIsRefreshing(false);
  };

  const currentTier = wallet?.tier || user?.wallet?.tier || 'free';
  const totalTokens =
    wallet?.totalTokensConsumed ?? user?.wallet?.totalTokensConsumed ?? 0;

  const governance = useWalletStore((state) => state.governance);
  const dailyLimit = governance?.dailyGeminiQuotaLimit || 1500;
  const callsRemaining = governance?.dailyRequestsRemaining ?? dailyLimit;

  const isPro = currentTier === 'pro_monthly';

  const handlePaymentSuccess = (result) => {
    const creditsAdded = result.transaction?.creditsAdded || 'credits';
    setNotification(
      `Payment verified! +${creditsAdded.toLocaleString()} credits added to your wallet.`,
    );
    setTimeout(() => setNotification(null), 7000);
  };

  const handleOpenCheckout = (plan) => {
    setActiveCheckoutPlan(plan);
  };

  const handleModalPayment = async (plan) => {
    return new Promise((resolve, reject) => {
      simulateTestRecharge({
        plan,
        onPaymentSuccess: (result) => {
          handlePaymentSuccess(result);
          resolve(result);
        },
        onPaymentError: (err) => {
          reject(err);
        },
      });
    });
  };

  const handleDirectSimulate = (plan) => {
    simulateTestRecharge({
      plan,
      onPaymentSuccess: handlePaymentSuccess,
    });
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <PageHeader
        title="Wallet &amp; Billing"
        description="Utility-metered credit ledger backed by real AI token usage."
        actions={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={
              <RefreshCw
                size={14}
                className={isRefreshing ? styles.spinIcon : ''}
              />
            }
            loading={isRefreshing}
            onClick={handleManualSync}
            title="Sync balance from server"
          >
            Sync Balance
          </Button>
        }
      />

      {/* Google Gemini Free-Tier Quota Banner */}
      <div className={styles.quotaModeBanner}>
        <div className={styles.quotaModeHeader}>
          <Zap size={18} className={styles.quotaIcon} />
          <div className={styles.quotaText}>
            <strong>⚡ Google Gemini Free Tier Active:</strong>
            <span>
              Platform is running on Google Gemini API free-tier quota ({callsRemaining.toLocaleString()} / {dailyLimit.toLocaleString()} daily calls left today • Resets at 00:00 UTC). All AI features (chat, mock interviews, library, document drafting) run directly without credit limitations.
            </span>
          </div>
          <Badge tone="accent">{dailyLimit.toLocaleString()} RPD Active</Badge>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className={styles.errorBanner} role="alert">
          <div className={styles.bannerContent}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <div className={styles.bannerActions}>
            <Button variant="secondary" size="sm" onClick={handleManualSync}>
              Retry
            </Button>
            <button
              type="button"
              className={styles.dismissBtn}
              onClick={clearError}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Payment Success Alert */}
      {notification && (
        <div className={styles.successBanner} role="status">
          <div className={styles.bannerContent}>
            <CheckCircle2 size={18} />
            <span>{notification}</span>
          </div>
          <button
            type="button"
            className={styles.dismissBtn}
            onClick={() => setNotification(null)}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Unified "My Current Plan & Quota" Window */}
      <Card padding="lg" className={styles.myPlanCard}>
        <div className={styles.myPlanGrid}>
          {/* Active Tier Column */}
          <div className={styles.tierCol}>
            <div className={styles.tierHeader}>
              <Crown size={20} className={isPro ? styles.crownPro : styles.crownFree} />
              <span className={styles.tierSubtitle}>Current Active Plan</span>
            </div>
            <div className={styles.tierTitleRow}>
              <h2 className={styles.tierTitle}>Academic Free Tier</h2>
              <Badge tone="accent">Active</Badge>
            </div>
            <p className={styles.tierPerks}>
              Standard Gemini 3.8 Flash access • Full feature set • {dailyLimit.toLocaleString()} daily requests
            </p>
          </div>

          {/* Daily Quota Column */}
          <div className={styles.creditsCol}>
            <div className={styles.creditsHeader}>
              <span className={styles.colLabel}>Daily API Quota Allowance</span>
              <Badge tone="accent">{dailyLimit.toLocaleString()} RPD</Badge>
            </div>
            <div className={styles.creditValueRow}>
              <span className={styles.creditsBig}>{callsRemaining.toLocaleString()}</span>
              <span className={styles.creditsUnit}>calls left</span>
            </div>
            <span className={styles.creditsHint}>
              Out of {dailyLimit.toLocaleString()} daily requests • Resets at 00:00 UTC
            </span>
          </div>

          {/* Cumulative Token Consumption Column */}
          <div className={styles.usageCol}>
            <div className={styles.usageHeader}>
              <span className={styles.colLabel}>Total Tokens Consumed</span>
              <Sparkles size={16} className={styles.sparkleIcon} />
            </div>
            <div className={styles.tokenValueRow}>
              <span className={styles.tokensBig}>{totalTokens.toLocaleString()}</span>
              <span className={styles.tokensUnit}>tokens</span>
            </div>
            <span className={styles.creditsHint}>Cumulative input + output across all models</span>
          </div>
        </div>
      </Card>

      {/* Recharge & Upgrade Plans Section (Future Scope / Commercial Roadmap) */}
      <section className={styles.plansSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleRow}>
            <Zap size={22} className={styles.zapIcon} />
            <h2>Recharge &amp; Upgrade Plans</h2>
            <Badge tone="neutral" style={{ marginLeft: 8 }}>Future Scope</Badge>
          </div>
          <p>
            Future commercial monetization &amp; subscription tiers. Razorpay Test Mode checkout can be simulated below for demonstration.
          </p>
        </div>

        <div className={styles.plansGrid}>
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrentTier={isPro && plan.tier === 'pro_monthly'}
              isProcessing={isProcessingCheckout && activeCheckoutPlan?.id === plan.id}
              onCheckout={handleOpenCheckout}
              onSimulate={handleDirectSimulate}
            />
          ))}
        </div>
      </section>

      {/* Billing Ledger / Transaction History */}
      <section className={styles.historySection}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleRow}>
            <Wallet size={20} style={{ color: 'var(--color-text-secondary)' }} />
            <h2>Transaction History</h2>
          </div>
          <p>Audited transaction ledger ensuring each recharge is credited exactly once.</p>
        </div>

        <TransactionTable
          transactions={transactions}
          pagination={pagination}
          isLoading={isLoadingTransactions}
          onPageChange={(page) => fetchTransactions(page)}
        />
      </section>

      {/* Razorpay Test Mode Animation Modal */}
      <RazorpayPaymentModal
        open={Boolean(activeCheckoutPlan)}
        plan={activeCheckoutPlan}
        onClose={() => setActiveCheckoutPlan(null)}
        onPaymentSuccess={handleModalPayment}
      />
    </div>
  );
}

import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useWalletStore } from '@/store/walletStore';
import styles from './CreditBadge.module.scss';

/**
 * CreditBadge component - Displays remaining AI credits and active governance mode
 * Specified in docs/PRD.md Section 8.G and ADR-027
 *
 * @param {object} props
 * @param {number} [props.credits=100] - Credits balance
 * @param {() => void} [props.onClick] - Optional click handler (e.g. navigate to /wallet)
 * @param {'sm' | 'md' | 'lg'} [props.size='md'] - Visual size variant
 * @param {boolean} [props.showIcon=true] - Whether to show the lightning Zap icon
 * @param {'quota_free' | 'credit_strict'} [props.mode] - Optional mode override
 * @param {number} [props.dailyRequestsRemaining] - Optional remaining quota calls override
 * @param {string} [props.className] - Additional CSS class
 */
export function CreditBadge({
  onClick,
  size = 'md',
  showIcon = true,
  dailyRequestsRemaining,
  className,
}) {
  const storeGovernance = useWalletStore((state) => state.governance);
  const remaining =
    dailyRequestsRemaining ?? storeGovernance?.dailyRequestsRemaining ?? 1500;
  const dailyLimit = storeGovernance?.dailyGeminiQuotaLimit ?? 1500;

  const tooltip = `⚡ Google Gemini API Quota: ${remaining.toLocaleString()} / ${dailyLimit.toLocaleString()} daily requests remaining. Resets daily at 00:00 UTC.`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        styles.badge,
        styles[size],
        styles.quotaMode,
        className,
      )}
      title={tooltip}
      aria-label={tooltip}
    >
      {showIcon && (
        <Zap
          size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14}
          fill="currentColor"
          className={styles.icon}
        />
      )}
      <span className={styles.label}>
        <span className={styles.quotaPill}>Quota:</span>
        <strong className={styles.value}>{remaining.toLocaleString()}</strong>
        <span className={styles.unit}> / {dailyLimit.toLocaleString()} left</span>
      </span>
    </button>
  );
}

export default CreditBadge;

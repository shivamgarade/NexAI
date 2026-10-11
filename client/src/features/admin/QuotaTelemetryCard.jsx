import {
  Activity,
  Gauge,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import styles from './QuotaTelemetryCard.module.scss';

/**
 * QuotaTelemetryCard component - Displays live Google Gemini API quota metrics,
 * rate limit monitors (1,500 RPD, 15 RPM, 1M TPM), and daily token breakdown.
 *
 * @param {object} props
 * @param {object} props.telemetry - Gemini API telemetry metrics from backend
 * @param {object} [props._config] - System governance config from backend
 */
export function QuotaTelemetryCard({
  telemetry,
  _config,
}) {
  const dailyLimit = telemetry?.dailyLimit ?? 1500;
  const requestsToday = telemetry?.requestsToday ?? 0;
  const requestsRemaining = telemetry?.requestsRemaining ?? Math.max(0, dailyLimit - requestsToday);
  const quotaPercentage = telemetry?.quotaUsedPercentage ?? Math.min(
    100,
    Number(((requestsToday / dailyLimit) * 100).toFixed(1)),
  );

  const rpm = telemetry?.rpm ?? 0;
  const rpmLimit = telemetry?.rpmLimit ?? 15;
  const rpmPercent = Math.min(100, Math.round((rpm / rpmLimit) * 100));

  const tpm = telemetry?.tpm ?? 0;
  const tpmLimit = telemetry?.tpmLimit ?? 1000000;

  const tokensToday = telemetry?.tokensToday || {
    total: 0,
    avgTokensPerRequest: 0,
  };

  const activeModel =
    telemetry?.activeModel ||
    tokensToday?.activeModel ||
    'gemini-3.5-flash-lite';

  const avgTokensPerCall =
    tokensToday?.avgTokensPerRequest ??
    (requestsToday > 0 ? Math.round(tokensToday.total / requestsToday) : 0);

  return (
    <Card className={styles.container}>
      {/* Top Header */}
      <div className={styles.headerRow}>
        <div className={styles.headerInfo}>
          <div className={styles.titleGroup}>
            <div className={styles.iconCircle}>
              <Gauge size={20} />
            </div>
            <div>
              <div className={styles.titleWithBadge}>
                <h3 className={styles.title}>Live Google Gemini API Quota Telemetry</h3>
                <Badge tone="accent">
                  ⚡ {dailyLimit.toLocaleString()} RPD Active
                </Badge>
              </div>
              <p className={styles.description}>
                Quota limits ({dailyLimit.toLocaleString()} RPD • 15 RPM • 1M TPM) reset daily at 00:00 UTC.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.toggleGroup}>
          <div className={styles.modeStatus}>
            <span className={styles.modeLabel}>Active Quota Engine:</span>
            <strong className={styles.modeName}>
              Google Gemini Free Tier ({dailyLimit.toLocaleString()} RPD)
            </strong>
          </div>
        </div>
      </div>

      {/* Main Grid: Daily Quota Progress Gauge | Rate Monitors | Daily Token Breakdown */}
      <div className={styles.metricsGrid}>
        {/* Daily Quota Progress Gauge */}
        <div className={styles.metricCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Daily Quota Progress ({dailyLimit.toLocaleString()} RPD)</span>
            <Clock size={15} className={styles.cardIcon} />
          </div>

          <div className={styles.rpdValueRow}>
            <span className={styles.rpdBig}>{requestsToday.toLocaleString()}</span>
            <span className={styles.rpdCeiling}>/ {dailyLimit.toLocaleString()} requests</span>
          </div>

          {/* Progress Bar Gauge */}
          <div className={styles.progressBarWrapper}>
            <div
              className={styles.progressBarFill}
              style={{ width: `${Math.max(2, Math.min(100, quotaPercentage))}%` }}
              role="progressbar"
              aria-valuenow={requestsToday}
              aria-valuemin={0}
              aria-valuemax={dailyLimit}
            />
          </div>

          <div className={styles.gaugeFooter}>
            <span className={styles.quotaPct}>{quotaPercentage}% consumed</span>
            <span className={styles.callsLeft}>
              <strong>{requestsRemaining.toLocaleString()}</strong> calls remaining today
            </span>
          </div>
        </div>

        {/* 15 RPM & TPM Live Rate Limit Indicators */}
        <div className={styles.metricCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Live Rate Limit Indicators</span>
            <Activity size={15} className={styles.cardIcon} />
          </div>

          <div className={styles.rateRow}>
            <div className={styles.rateCol}>
              <span className={styles.rateSub}>Requests / Min (15 Limit)</span>
              <div className={styles.rateVal}>
                <span className={styles.valNumber}>{rpm}</span>
                <span className={styles.valMax}>/ 15 RPM</span>
              </div>
              <div className={styles.miniBar}>
                <div
                  className={styles.miniBarFill}
                  style={{
                    width: `${Math.max(4, rpmPercent)}%`,
                    backgroundColor: rpm >= 12 ? 'var(--color-danger)' : 'var(--color-accent)',
                  }}
                />
              </div>
            </div>

            <div className={styles.rateDivider} />

            <div className={styles.rateCol}>
              <span className={styles.rateSub}>Tokens / Min (1M Limit)</span>
              <div className={styles.rateVal}>
                <span className={styles.valNumber}>{tpm.toLocaleString()}</span>
                <span className={styles.valMax}>/ 1M TPM</span>
              </div>
              <div className={styles.miniBar}>
                <div
                  className={styles.miniBarFill}
                  style={{
                    width: `${Math.max(4, Math.min(100, (tpm / tpmLimit) * 100))}%`,
                    backgroundColor: 'var(--color-info)',
                  }}
                />
              </div>
            </div>
          </div>

          <div className={styles.safetyFooter}>
            <ShieldCheck size={14} className={styles.shieldIcon} />
            <span>Rate governors nominal • Safe burst capacity</span>
          </div>
        </div>

        {/* Daily Token Consumption & Single AI Engine Telemetry */}
        <div className={styles.metricCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Daily Token Consumption</span>
            <Sparkles size={15} className={styles.cardIcon} />
          </div>

          <div className={styles.tokenTotalRow}>
            <span className={styles.tokenBig}>{tokensToday.total.toLocaleString()}</span>
            <span className={styles.tokenUnit}>tokens today</span>
          </div>

          <div className={styles.tokenSplitList}>
            <div className={styles.splitItem}>
              <div className={styles.splitTitle}>
                <ArrowDownLeft size={13} className={styles.inputArrow} />
                <span>Requests Completed:</span>
              </div>
              <strong>{requestsToday.toLocaleString()} calls</strong>
            </div>

            <div className={styles.splitItem}>
              <div className={styles.splitTitle}>
                <ArrowUpRight size={13} className={styles.outputArrow} />
                <span>Avg Tokens / Call:</span>
              </div>
              <strong>{avgTokensPerCall.toLocaleString()} tokens</strong>
            </div>

            <div className={styles.modelPillRow}>
              <span className={styles.modelChip}>Engine: {activeModel}</span>
              <span className={styles.modelChip}>Single AI Active</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default QuotaTelemetryCard;

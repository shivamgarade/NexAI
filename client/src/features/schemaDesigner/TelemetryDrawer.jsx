import { X, Activity, Zap, Clock, Coins, Cpu, Wallet } from 'lucide-react';
import { useSchemaStore } from '@/store/schemaStore';
import { useAuthStore } from '@/store/authStore';
import styles from './TelemetryDrawer.module.scss';

export function TelemetryDrawer() {
  const { telemetry, isTelemetryDrawerOpen, setTelemetryDrawerOpen } = useSchemaStore();
  const user = useAuthStore((state) => state.user);

  if (!isTelemetryDrawerOpen) return null;

  const currentBalance =
    telemetry?.creditsRemaining !== undefined
      ? telemetry.creditsRemaining
      : user?.wallet?.creditsRemaining ?? 0;

  return (
    <>
      <div
        className={styles.backdrop}
        onClick={() => setTelemetryDrawerOpen(false)}
        aria-hidden="true"
      />
      <aside className={styles.drawer} aria-label="AI Schema Telemetry">
        <div className={styles.header}>
          <h3>
            <Activity size={18} className="text-accent" />
            AI Execution Telemetry
          </h3>
          <button
            type="button"
            className={styles.btnClose}
            onClick={() => setTelemetryDrawerOpen(false)}
            aria-label="Close telemetry drawer"
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.formulaNote}>
            <strong>Credit Metering Rule:</strong> Credits are deducted atomically from real Gemini token
            usage: <code>ceil(totalTokens / 100)</code> with an immutable <code>UsageLog</code> audit trail.
          </div>

          <div className={styles.statCard}>
            <div className={styles.statLabel}>
              <Zap size={13} className="text-accent" />
              Tokens Consumed
            </div>
            <div className={styles.statValue}>
              {telemetry ? Number(telemetry.tokensUsed || 0).toLocaleString() : '0'}
            </div>
            <div className={styles.statSubtitle}>Prompt + Candidates Token Usage</div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statLabel}>
              <Coins size={13} className="text-warning" />
              Credits Deducted
            </div>
            <div className={styles.statValue}>
              {telemetry?.creditsDeducted ?? 0}
            </div>
            <div className={styles.statSubtitle}>
              {telemetry?.tokensUsed ? `ceil(${telemetry.tokensUsed} / 100)` : 'No charge'}
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statLabel}>
              <Clock size={13} className="text-info" />
              Generation Latency
            </div>
            <div className={styles.statValue}>
              {telemetry?.durationMs ? `${(telemetry.durationMs / 1000).toFixed(2)}s` : '0.00s'}
            </div>
            <div className={styles.statSubtitle}>Total round-trip API processing time</div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statLabel}>
              <Cpu size={13} className="text-success" />
              AI Model Engine
            </div>
            <div className={styles.statValue} style={{ fontSize: 'var(--text-base)' }}>
              {telemetry?.model === 'pro' ? 'Gemini Pro' : 'Gemini Flash'}
            </div>
            <div className={styles.statSubtitle}>Configured via server environment variables</div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statLabel}>
              <Wallet size={13} />
              Wallet Balance
            </div>
            <div className={styles.statValue}>
              {currentBalance} <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'normal' }}>credits</span>
            </div>
            <div className={styles.statSubtitle}>Current user credit balance</div>
          </div>
        </div>
      </aside>
    </>
  );
}

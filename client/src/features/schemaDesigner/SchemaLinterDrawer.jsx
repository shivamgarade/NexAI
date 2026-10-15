import PropTypes from 'prop-types';
import { X, ShieldCheck, AlertTriangle, AlertCircle, Info, Sparkles, CheckCircle2 } from 'lucide-react';
import { useSchemaStore } from '@/store/schemaStore';
import { Button } from '@/components/ui';
import styles from './SchemaLinterDrawer.module.scss';

export function SchemaLinterDrawer() {
  const {
    isLinterDrawerOpen,
    setLinterDrawerOpen,
    healthScore,
    linterIssues,
    linterSummary,
    autoFixLinterIssue,
    ir,
  } = useSchemaStore();

  if (!isLinterDrawerOpen) return null;

  const totalTables = Object.keys(ir?.entities || {}).length;

  return (
    <aside className={styles.drawerOverlay} onClick={() => setLinterDrawerOpen(false)}>
      <div className={styles.drawerPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <ShieldCheck size={20} className={styles.iconShield} />
            <div>
              <h2>Schema Health & Linter</h2>
              <span className={styles.subtitle}>Deterministic rule-engine analysis</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => setLinterDrawerOpen(false)}
            aria-label="Close linter"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scorecard Hero */}
        <div className={styles.scoreHero}>
          <div className={styles.scoreGauge}>
            <span
              className={`${styles.scoreNumber} ${
                healthScore >= 90
                  ? styles.scoreGreen
                  : healthScore >= 70
                  ? styles.scoreYellow
                  : styles.scoreRed
              }`}
            >
              {healthScore}
            </span>
            <span className={styles.scoreMax}>/100</span>
          </div>

          <div className={styles.scoreDetails}>
            <div className={styles.gradeBadge}>Grade: {linterSummary.grade}</div>
            <p className={styles.scoreSummaryText}>
              {healthScore >= 90
                ? 'Production-ready database architecture with strong relational integrity.'
                : healthScore >= 70
                ? 'Good foundation with minor indexing or timestamp optimizations needed.'
                : 'Contains high-severity issues (missing primary keys or unindexed constraints).'}
            </p>
            <div className={styles.statsRow}>
              <span className={styles.statChip}>
                <strong>{totalTables}</strong> tables
              </span>
              <span className={`${styles.statChip} ${styles.errChip}`}>
                <strong>{linterSummary.errors}</strong> errors
              </span>
              <span className={`${styles.statChip} ${styles.warnChip}`}>
                <strong>{linterSummary.warnings}</strong> warnings
              </span>
              <span className={`${styles.statChip} ${styles.infoChip}`}>
                <strong>{linterSummary.info}</strong> info
              </span>
            </div>
          </div>
        </div>

        {/* Issues List */}
        <div className={styles.issuesList}>
          {linterIssues.length === 0 ? (
            <div className={styles.allClean}>
              <CheckCircle2 size={36} className={styles.cleanIcon} />
              <h3>All Schema Checks Passed!</h3>
              <p>Your database schema meets 100% of normalization and integrity best practices.</p>
            </div>
          ) : (
            linterIssues.map((issue) => (
              <div
                key={issue.id}
                className={`${styles.issueCard} ${
                  issue.severity === 'error'
                    ? styles.isError
                    : issue.severity === 'warning'
                    ? styles.isWarning
                    : styles.isInfo
                }`}
              >
                <div className={styles.issueHeader}>
                  <div className={styles.issueTitleGroup}>
                    {issue.severity === 'error' ? (
                      <AlertCircle size={16} className={styles.iconErr} />
                    ) : issue.severity === 'warning' ? (
                      <AlertTriangle size={16} className={styles.iconWarn} />
                    ) : (
                      <Info size={16} className={styles.iconInfo} />
                    )}
                    <span className={styles.issueTitle}>{issue.title}</span>
                  </div>
                  <span className={styles.entityTag}>{issue.entityName}</span>
                </div>

                <p className={styles.issueMessage}>{issue.message}</p>

                {issue.suggestion && (
                  <div className={styles.suggestionRow}>
                    <span className={styles.suggLabel}>Recommendation:</span> {issue.suggestion}
                  </div>
                )}

                {issue.canAutoFix && (
                  <div className={styles.actionRow}>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Sparkles size={12} />}
                      onClick={() => autoFixLinterIssue(issue.id)}
                    >
                      Apply Auto-Fix
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

SchemaLinterDrawer.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
};

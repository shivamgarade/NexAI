import { Database, Bookmark, Activity, RotateCcw } from 'lucide-react';
import { useSchemaStore } from '@/store/schemaStore';
import { Button } from '@/components/ui';
import styles from './SchemaHeader.module.scss';

export function SchemaHeader() {
  const {
    currentSchema,
    telemetry,
    setReviewModalOpen,
    setTelemetryDrawerOpen,
    reset,
  } = useSchemaStore();

  return (
    <header className={styles.headerContainer}>
      <div className={styles.titleArea}>
        <div className={styles.titleRow}>
          <Database size={24} className="text-accent" />
          <h1>Data Modeling & Schema Studio</h1>
          <span className={styles.badgeStudio}>Architect AI</span>
        </div>
        <p className={styles.subtitle}>
          Synthesize normalized schemas, visual interactive ERDs, and multi-dialect code models with Gemini.
        </p>
      </div>

      <div className={styles.actions}>
        {telemetry && (
          <button
            type="button"
            className={styles.telemetryBtn}
            onClick={() => setTelemetryDrawerOpen(true)}
            title="Inspect AI execution telemetry"
          >
            <Activity size={14} className="text-accent" />
            <span>{telemetry.tokensUsed || 0} tokens ({telemetry.creditsDeducted || 0} cr)</span>
          </button>
        )}

        {currentSchema && (
          <>
            <Button
              variant="secondary"
              onClick={() => setReviewModalOpen(true)}
            >
              <Bookmark size={15} />
              Save to Library
            </Button>

            <Button
              variant="ghost"
              onClick={reset}
              title="Reset designer canvas"
            >
              <RotateCcw size={15} />
              New
            </Button>
          </>
        )}
      </div>
    </header>
  );
}

import PropTypes from 'prop-types';
import { Database, Bookmark, Activity, RotateCcw, Columns2, Network, Code2, Plus } from 'lucide-react';
import { useSchemaStore } from '@/store/schemaStore';
import { Button } from '@/components/ui';
import styles from './SchemaHeader.module.scss';

export function SchemaHeader({ viewMode = 'split', setViewMode }) {
  const {
    currentSchema,
    telemetry,
    setReviewModalOpen,
    setTelemetryDrawerOpen,
    addEntity,
    reset,
  } = useSchemaStore();

  return (
    <header className={styles.headerContainer}>
      <div className={styles.titleArea}>
        <div className={styles.titleRow}>
          <div className={styles.iconWrapper}>
            <Database size={18} className="text-accent" />
          </div>
          <div className={styles.titleText}>
            <h1>Data Modeling Studio</h1>
            <span className={styles.badgeStudio}>Architect AI</span>
          </div>
        </div>
      </div>

      {/* Central View Switcher Tabs */}
      {setViewMode && (
        <div className={styles.centerTabs} role="tablist" aria-label="Studio view layout">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'split'}
            className={`${styles.tabBtn} ${viewMode === 'split' ? styles.active : ''}`}
            onClick={() => setViewMode('split')}
            title="Side-by-side Split View"
          >
            <Columns2 size={13} />
            <span>Split View</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'erd'}
            className={`${styles.tabBtn} ${viewMode === 'erd' ? styles.active : ''}`}
            onClick={() => setViewMode('erd')}
            title="Full-Width ERD Architecture Canvas"
          >
            <Network size={13} />
            <span>ERD Canvas</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'code'}
            className={`${styles.tabBtn} ${viewMode === 'code' ? styles.active : ''}`}
            onClick={() => setViewMode('code')}
            title="Full-Width Code Studio & Editor"
          >
            <Code2 size={13} />
            <span>Code Studio</span>
          </button>
        </div>
      )}

      <div className={styles.actions}>
        {telemetry && (
          <button
            type="button"
            className={styles.telemetryBtn}
            onClick={() => setTelemetryDrawerOpen(true)}
            title="Inspect AI execution telemetry"
          >
            <Activity size={13} className="text-accent" />
            <span>{telemetry.tokensUsed || 0} tok ({telemetry.creditsDeducted || 0} cr)</span>
          </button>
        )}

        {currentSchema && (
          <>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Plus size={14} />}
              onClick={() => addEntity()}
              title="Add a new entity / table to canvas"
              className={styles.headerBtn}
            >
              Add Entity
            </Button>

            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Bookmark size={14} />}
              onClick={() => setReviewModalOpen(true)}
              className={styles.headerBtn}
            >
              Save to Library
            </Button>

            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RotateCcw size={14} />}
              onClick={reset}
              title="Reset studio canvas"
              className={styles.headerBtn}
            >
              New
            </Button>
          </>
        )}
      </div>
    </header>
  );
}

SchemaHeader.propTypes = {
  viewMode: PropTypes.oneOf(['split', 'erd', 'code']),
  setViewMode: PropTypes.func,
};

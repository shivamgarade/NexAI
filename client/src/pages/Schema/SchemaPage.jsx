import { useState, useRef, useEffect, useCallback } from 'react';
import {
  SchemaHeader,
  VisualErdCanvas,
  CodeEditorPanel,
  SchemaPromptBar,
  SchemaHero,
  SchemaReviewModal,
} from '@/features/schemaDesigner';
import { useSchemaStore } from '@/store/schemaStore';
import styles from './SchemaPage.module.scss';

const DEFAULT_SPLIT_PERCENT = 58; // 58% canvas, 42% code
const MIN_SPLIT_PERCENT = 25;
const MAX_SPLIT_PERCENT = 75;

export default function SchemaPage() {
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'erd' | 'code'
  const [splitPercent, setSplitPercent] = useState(DEFAULT_SPLIT_PERCENT);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const { model, aiPreview, isLoading } = useSchemaStore();

  const hasEntities = Boolean(model?.entities && model.entities.length > 0);
  const showStudio = hasEntities || Boolean(aiPreview?.model?.entities?.length) || isLoading;

  // Mouse move handler during divider dragging
  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const percent = (relativeX / rect.width) * 100;
      const clamped = Math.min(Math.max(percent, MIN_SPLIT_PERCENT), MAX_SPLIT_PERCENT);
      setSplitPercent(clamped);
    },
    [isDragging]
  );

  // Mouse up handler to stop dragging
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!showStudio) {
    return (
      <div className={styles.emptyPageWrapper}>
        <SchemaHero />
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      <SchemaHeader viewMode={viewMode} setViewMode={setViewMode} />

      <main
        ref={containerRef}
        className={`${styles.studioGrid} ${
          viewMode === 'erd'
            ? styles.viewErd
            : viewMode === 'code'
            ? styles.viewCode
            : styles.viewSplit
        } ${isDragging ? styles.isDragging : ''}`}
        style={
          viewMode === 'split'
            ? {
                gridTemplateColumns: `${splitPercent}% var(--space-2) 1fr`,
              }
            : undefined
        }
      >
        {(viewMode === 'split' || viewMode === 'erd') && (
          <div className={styles.paneLeft}>
            <VisualErdCanvas />
          </div>
        )}

        {viewMode === 'split' && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={Math.round(splitPercent)}
            aria-valuemin={MIN_SPLIT_PERCENT}
            aria-valuemax={MAX_SPLIT_PERCENT}
            tabIndex={0}
            className={`${styles.splitDivider} ${isDragging ? styles.dividerActive : ''}`}
            onMouseDown={() => setIsDragging(true)}
            onDoubleClick={() => setSplitPercent(DEFAULT_SPLIT_PERCENT)}
            title="Drag to resize panels (Double-click to reset)"
          >
            <div className={styles.dividerKnob} />
          </div>
        )}

        {(viewMode === 'split' || viewMode === 'code') && (
          <div className={styles.paneRight}>
            <CodeEditorPanel />
          </div>
        )}
      </main>

      {/* Docked AI Refinement Prompt Bar (never overlaps canvas) */}
      <SchemaPromptBar />

      <SchemaReviewModal />
    </div>
  );
}

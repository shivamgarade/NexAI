import { useState } from 'react';
import { Columns2, Network, Code2, SlidersHorizontal } from 'lucide-react';
import {
  SchemaHeader,
  PromptPanel,
  VisualErdCanvas,
  CodeInspector,
  TelemetryDrawer,
  SchemaReviewModal,
} from '@/features/schemaDesigner';
import { useSchemaStore } from '@/store/schemaStore';
import styles from './SchemaPage.module.scss';

export default function SchemaPage() {
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'erd' | 'code'
  const currentSchema = useSchemaStore((state) => state.currentSchema);

  return (
    <div className={styles.pageWrapper}>
      <SchemaHeader />
      <PromptPanel />

      {currentSchema && (
        <div className={styles.viewModeBar}>
          <div className={styles.viewModeLabel}>
            <SlidersHorizontal size={14} className="text-accent" />
            <span>Studio Workspace Layout:</span>
          </div>

          <div className={styles.viewToggles} role="group" aria-label="Layout view switcher">
            <button
              type="button"
              className={`${styles.toggleBtn} ${viewMode === 'split' ? styles.active : ''}`}
              onClick={() => setViewMode('split')}
              title="Side-by-side Split View"
            >
              <Columns2 size={13} />
              <span>Split View</span>
            </button>

            <button
              type="button"
              className={`${styles.toggleBtn} ${viewMode === 'erd' ? styles.active : ''}`}
              onClick={() => setViewMode('erd')}
              title="Full-Width ERD Diagram Focus"
            >
              <Network size={13} />
              <span>ERD Focus</span>
            </button>

            <button
              type="button"
              className={`${styles.toggleBtn} ${viewMode === 'code' ? styles.active : ''}`}
              onClick={() => setViewMode('code')}
              title="Full-Width Code Inspector Focus"
            >
              <Code2 size={13} />
              <span>Code Focus</span>
            </button>
          </div>
        </div>
      )}

      <div
        className={`${styles.studioGrid} ${
          viewMode === 'erd'
            ? styles.viewErd
            : viewMode === 'code'
            ? styles.viewCode
            : styles.viewSplit
        }`}
      >
        {(viewMode === 'split' || viewMode === 'erd') && <VisualErdCanvas />}
        {(viewMode === 'split' || viewMode === 'code') && <CodeInspector />}
      </div>

      <TelemetryDrawer />
      <SchemaReviewModal />
    </div>
  );
}

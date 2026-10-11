import { useState } from 'react';
import {
  SchemaHeader,
  VisualErdCanvas,
  CodeInspector,
  FloatingPromptBar,
  TelemetryDrawer,
  SchemaReviewModal,
} from '@/features/schemaDesigner';
import styles from './SchemaPage.module.scss';

export default function SchemaPage() {
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'erd' | 'code'

  return (
    <div className={styles.pageWrapper}>
      <SchemaHeader viewMode={viewMode} setViewMode={setViewMode} />

      <main
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
      </main>

      <FloatingPromptBar />
      <TelemetryDrawer />
      <SchemaReviewModal />
    </div>
  );
}

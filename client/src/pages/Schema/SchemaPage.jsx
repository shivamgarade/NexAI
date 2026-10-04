import {
  SchemaHeader,
  PromptPanel,
  VisualErdCanvas,
  CodeInspector,
  TelemetryDrawer,
  SchemaReviewModal,
} from '@/features/schemaDesigner';
import styles from './SchemaPage.module.scss';

export default function SchemaPage() {
  return (
    <div className={styles.pageWrapper}>
      <SchemaHeader />
      <PromptPanel />

      <div className={styles.studioGrid}>
        <VisualErdCanvas />
        <CodeInspector />
      </div>

      <TelemetryDrawer />
      <SchemaReviewModal />
    </div>
  );
}

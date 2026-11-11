import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Spinner } from '@/components/ui/Spinner';
import { NexAiLogo } from '@/components/ui/NexAiLogo';
import styles from './AuthLayout.module.scss';

export function AuthLayout() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            <NexAiLogo size={48} glow />
          </div>
          <h1>NexAI</h1>
          <p>AI-Powered Personal &amp; Developer Workspace</p>
        </div>
        <Suspense
          fallback={
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-6)' }}>
              <Spinner size="md" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}

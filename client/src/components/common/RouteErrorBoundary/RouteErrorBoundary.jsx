import { useRouteError, useNavigate } from 'react-router-dom';
import { AlertTriangle, RotateCcw, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants/routes';
import styles from './RouteErrorBoundary.module.scss';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  const errorMessage =
    error?.statusText ||
    error?.message ||
    (typeof error === 'string' ? error : 'An unexpected error occurred while loading this view.');

  return (
    <div className={styles.container} role="alert">
      <div className={styles.card}>
        <div className={styles.iconWrapper}>
          <AlertTriangle size={36} className={styles.alertIcon} />
        </div>
        <h1 className={styles.title}>Something went wrong</h1>
        <p className={styles.subtitle}>
          The application encountered an unexpected error while rendering this page.
        </p>
        <div className={styles.errorBox}>
          <code>{errorMessage}</code>
        </div>
        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="md"
            leftIcon={<RotateCcw size={15} />}
            onClick={() => window.location.reload()}
          >
            Reload Page
          </Button>
          <Button
            variant="primary"
            size="md"
            leftIcon={<MessageSquare size={15} />}
            onClick={() => navigate(ROUTES.CHAT)}
          >
            Return to Chat
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Download, X, Share, PlusSquare, Smartphone } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import styles from './PWAInstallBanner.module.scss';

export function PWAInstallBanner() {
  const {
    isInstallable,
    isInstalled,
    isIOSSafari,
    showIOSGuide,
    setShowIOSGuide,
    promptInstall,
  } = usePWAInstall();

  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('nexai_pwa_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('nexai_pwa_banner_dismissed', 'true');
    } catch {
      // Ignore sessionStorage errors
    }
  };

  if (isInstalled || !isInstallable || isDismissed) {
    return null;
  }

  return (
    <>
      <div className={styles.banner} role="region" aria-label="Install NexAI App">
        <div className={styles.leftGroup}>
          <div className={styles.appIconWrap}>
            <Smartphone size={18} />
          </div>
          <div className={styles.textContent}>
            <span className={styles.title}>Install NexAI Workspace</span>
            <span className={styles.subtitle}>
              Fast offline access, native notifications, and distraction-free standalone canvas.
            </span>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.installBtn}
            onClick={promptInstall}
            aria-label="Install App"
          >
            <Download size={13} />
            <span>Install App</span>
          </button>
          <button
            type="button"
            className={styles.dismissBtn}
            onClick={handleDismiss}
            aria-label="Dismiss banner"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* iOS Safari Guide Modal */}
      {showIOSGuide && isIOSSafari && (
        <div
          className={styles.iosModalOverlay}
          onClick={() => setShowIOSGuide(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className={styles.iosModalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.iosHeader}>
              <h3 className={styles.iosTitle}>Install NexAI on iOS</h3>
              <button
                type="button"
                className={styles.dismissBtn}
                onClick={() => setShowIOSGuide(false)}
                aria-label="Close guide"
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.iosSteps}>
              <div className={styles.iosStepItem}>
                <span className={styles.iosStepNumber}>1</span>
                <div>
                  Tap the <strong>Share</strong> button at the bottom of Safari{' '}
                  <Share size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
                </div>
              </div>
              <div className={styles.iosStepItem}>
                <span className={styles.iosStepNumber}>2</span>
                <div>
                  Scroll down and tap <strong>Add to Home Screen</strong>{' '}
                  <PlusSquare size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
                </div>
              </div>
              <div className={styles.iosStepItem}>
                <span className={styles.iosStepNumber}>3</span>
                <div>
                  Tap <strong>Add</strong> in the top right to complete installation.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default PWAInstallBanner;

import { useState, useEffect, useCallback } from 'react';

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator?.standalone === true
    );
  });
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Detect iOS Safari environment where beforeinstallprompt is unsupported
  const isIOS =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !window.MSStream;

  const isSafari =
    typeof navigator !== 'undefined' &&
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  const isIOSSafari = isIOS && isSafari && !isInstalled;

  useEffect(() => {
    // Listen to changes in display-mode
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e) => {
      setIsInstalled(e.matches);
      if (e.matches) {
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    } else {
      mediaQuery.addListener(handleDisplayModeChange);
    }

    // Capture standard PWA installation event
    const handleBeforeInstallPrompt = (e) => {
      // Prevent automatic browser mini-infobar on mobile Chrome/Edge
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      } else {
        mediaQuery.removeListener(handleDisplayModeChange);
      }
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
      return choiceResult.outcome;
    }

    if (isIOSSafari) {
      setShowIOSGuide((prev) => !prev);
      return 'ios_guide_toggled';
    }

    return 'unavailable';
  }, [deferredPrompt, isIOSSafari]);

  return {
    isInstallable: isInstallable || isIOSSafari,
    hasNativePrompt: Boolean(deferredPrompt),
    isInstalled,
    isIOSSafari,
    showIOSGuide,
    setShowIOSGuide,
    promptInstall,
  };
}

export default usePWAInstall;

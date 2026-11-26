import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { router } from './router';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ToastViewport } from './components/ui/Toast';
import { useAuthStore } from './store/authStore';

export default function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const user = useAuthStore((state) => state.user);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Synchronize live appearance tokens (theme, colors, font, layout) from user preferences
  useEffect(() => {
    if (!user?.settings) return;
    const settings = user.settings;

    // 1. Theme (dark, light, system)
    const effectiveTheme =
      settings.theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : settings.theme || 'dark';
    document.documentElement.dataset.theme = effectiveTheme;

    // 2. Contrast
    if (settings.contrast) {
      document.documentElement.dataset.contrast = settings.contrast;
    }

    // 3. Screen Reader Mode
    if (settings.screenReaderMode !== undefined) {
      document.documentElement.dataset.screenReader = String(settings.screenReaderMode);
    }

    // 4. Font Family
    if (settings.font && settings.font !== 'System Default') {
      const fontStack =
        settings.font === 'Google Sans'
          ? '"Google Sans", "Outfit", system-ui, -apple-system, sans-serif'
          : settings.font === 'Geist'
            ? '"Geist", system-ui, -apple-system, sans-serif'
            : settings.font === 'Inter'
              ? '"Inter", system-ui, -apple-system, sans-serif'
              : settings.font === 'JetBrains Mono'
                ? '"JetBrains Mono", monospace'
                : settings.font === 'Fira Code'
                  ? '"Fira Code", monospace'
                  : `"${settings.font}", system-ui, sans-serif`;
      document.documentElement.style.setProperty('--font-sans', fontStack);
      document.documentElement.style.setProperty('--font-family', fontStack);
    }

    // 5. Font Size
    if (settings.fontSize) {
      document.documentElement.style.setProperty('--font-size-base', settings.fontSize);
    }

    // 6. Conversation Width
    if (settings.conversationWidth) {
      const widthMap = {
        narrow: '720px',
        default: '840px',
        wide: '1040px',
        fill: '100%',
      };
      const widthVal = widthMap[settings.conversationWidth] || '1040px';
      document.documentElement.style.setProperty('--chat-max-width', widthVal);
    }

    // 7. Custom Colors (Background, Foreground, Accent)
    const colors = settings.customColors || {};
    const isDark = effectiveTheme === 'dark';
    if (isDark) {
      const bg = colors.darkBg || '#070708';
      const fg = colors.darkFg || '#FFFFFF';
      const accent = colors.darkAccent || '#A2FF00';
      document.documentElement.style.setProperty('--color-bg-app', bg);
      document.documentElement.style.setProperty('--color-text-primary', fg);
      document.documentElement.style.setProperty('--color-accent', accent);
    } else {
      const bg = colors.lightBg || '#F9F9F9';
      const fg = colors.lightFg || '#101010';
      const accent = colors.lightAccent || '#007ACC';
      document.documentElement.style.setProperty('--color-bg-app', bg);
      document.documentElement.style.setProperty('--color-text-primary', fg);
      document.documentElement.style.setProperty('--color-accent', accent);
    }
  }, [user?.settings]);

  const content = (
    <ErrorBoundary>
      <RouterProvider router={router} />
      <ToastViewport />
    </ErrorBoundary>
  );

  if (googleClientId) {
    return <GoogleOAuthProvider clientId={googleClientId}>{content}</GoogleOAuthProvider>;
  }

  return content;
}

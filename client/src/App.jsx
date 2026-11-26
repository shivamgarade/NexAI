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

  // Synchronize live appearance tokens (theme, colors, font) from user preferences
  useEffect(() => {
    if (user?.settings?.theme) {
      document.documentElement.dataset.theme = user.settings.theme;
    }
    if (user?.settings?.customColors) {
      const colors = user.settings.customColors;
      const isDark = (user?.settings?.theme || 'dark') === 'dark';
      if (isDark) {
        if (colors.darkBg) document.documentElement.style.setProperty('--color-bg-app', colors.darkBg);
        if (colors.darkAccent) document.documentElement.style.setProperty('--color-accent', colors.darkAccent);
      } else {
        if (colors.lightBg) document.documentElement.style.setProperty('--color-bg-app', colors.lightBg);
        if (colors.lightAccent) document.documentElement.style.setProperty('--color-accent', colors.lightAccent);
      }
    }
    if (user?.settings?.font && user.settings.font !== 'System Default') {
      document.documentElement.style.setProperty('--font-sans', user.settings.font);
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

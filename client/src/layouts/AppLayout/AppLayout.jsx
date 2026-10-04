import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Drawer } from '@/components/ui/Drawer';
import { Spinner } from '@/components/ui/Spinner';
import { CommandPalette } from '@/features/command-palette';
import { SaveItemModal } from '@/features/library';
import { useUiStore } from '@/store/uiStore';
import { useWalletStore } from '@/store/walletStore';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils/cn';
import styles from './AppLayout.module.scss';


export function AppLayout() {
  const isDrawerOpen = useUiStore((state) => state.isDrawerOpen);
  const setDrawerOpen = useUiStore((state) => state.setDrawerOpen);
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const fetchWallet = useWalletStore((state) => state.fetchWallet);

  // Sync wallet and quota governance status on app mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchWallet();
    }
  }, [isAuthenticated, fetchWallet]);

  // Automatically close mobile drawer when navigating between routes
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname, setDrawerOpen]);

  const isChatRoute =
    location.pathname === '/chat' || location.pathname.startsWith('/chat/');
  const isWideRoute =
    location.pathname.startsWith('/interview') ||
    location.pathname.startsWith('/library');

  return (
    <div className={styles.layout}>
      {/* Desktop Sidebar */}
      <div className={styles.desktopSidebar}>
        <Sidebar />
      </div>

      {/* Mobile Drawer Sidebar */}
      <Drawer open={isDrawerOpen} onClose={() => setDrawerOpen(false)} title="NexAI" side="left">
        <Sidebar onItemClick={() => setDrawerOpen(false)} isMobile />
      </Drawer>

      <div className={styles.mainWrapper}>
        <Topbar />
        <main
          className={cn(
            styles.content,
            isChatRoute && styles.chatContent,
            isWideRoute && styles.wideContent,
          )}
        >
          <Suspense
            fallback={
              <div
                style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}
              >
                <Spinner size="lg" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>

      <CommandPalette />
      <SaveItemModal />
    </div>
  );
}


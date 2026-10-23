import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Drawer } from '@/components/ui/Drawer';
import { Spinner } from '@/components/ui/Spinner';
import { CommandPalette } from '@/features/command-palette';
import { SaveItemModal } from '@/features/library';
import { PWAInstallBanner } from '@/components/common/PWAInstallBanner';
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

  // Global Ctrl+B shortcut to toggle sidebar & Auto-collapse below 1100px width
  const toggleSidebarCollapsed = useUiStore((state) => state.toggleSidebarCollapsed);
  const setSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebarCollapsed();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebarCollapsed]);

  useEffect(() => {
    let prevWidth = window.innerWidth;
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      // Auto-collapse when crossing below 1100px threshold
      if (currentWidth < 1100 && prevWidth >= 1100) {
        setSidebarCollapsed(true);
      }
      prevWidth = currentWidth;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setSidebarCollapsed]);

  const isChatRoute =
    location.pathname === '/chat' || location.pathname.startsWith('/chat/');
  const isSearchRoute = location.pathname === '/search';
  const isWideRoute =
    location.pathname.startsWith('/interview') ||
    location.pathname.startsWith('/library');
  const isFullWidthRoute = location.pathname.startsWith('/schema');

  return (
    <div className={styles.layout}>
      {/* Desktop Sidebar */}
      <div className={styles.desktopSidebar}>
        <Sidebar />
      </div>

      {/* Mobile Drawer Sidebar */}
      <Drawer
        open={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="NexAI"
        side="left"
        hideHeader
        className={styles.mobileNavDrawer}
      >
        <Sidebar onItemClick={() => setDrawerOpen(false)} isMobile />
      </Drawer>

      <div className={styles.mainWrapper}>
        <Topbar />
        <PWAInstallBanner />
        <main
          className={cn(
            styles.content,
            isChatRoute && styles.chatContent,
            isSearchRoute && styles.searchContent,
            isWideRoute && styles.wideContent,
            isFullWidthRoute && styles.fullWidthContent,
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


import { useNavigate } from 'react-router-dom';
import { Menu, Sun, Moon, Search } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { useTheme } from '@/hooks/useTheme';
import { IconButton } from '@/components/ui/IconButton';
import { Kbd } from '@/components/ui/Kbd';
import { CreditBadge } from '@/components/common/CreditBadge';
import { useAuthStore } from '@/store/authStore';
import { ROUTES } from '@/constants/routes';
import styles from './Topbar.module.scss';

export function Topbar() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const setDrawerOpen = useUiStore((state) => state.setDrawerOpen);
  const user = useAuthStore((state) => state.user);
  const credits = user?.wallet?.creditsRemaining ?? 100;

  const openCommandPalette = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
  };

  return (
    <header className={styles.topbar}>
      <div className={styles.leftGroup}>
        <div className={styles.menuButton}>
          <IconButton
            icon={<Menu size={20} />}
            label="Open navigation drawer"
            onClick={() => setDrawerOpen(true)}
          />
        </div>
        <button
          type="button"
          onClick={openCommandPalette}
          className={styles.searchTrigger}
          aria-label="Search or open command palette"
        >
          <Search size={16} />
          <span>Search workspace...</span>
          <Kbd>Ctrl K</Kbd>
        </button>
      </div>

      <div className={styles.rightGroup}>
        <CreditBadge credits={credits} onClick={() => navigate(ROUTES.WALLET)} />
        <IconButton
          icon={isDark ? <Sun size={18} /> : <Moon size={18} />}
          label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          onClick={toggleTheme}
        />
      </div>
    </header>
  );
}

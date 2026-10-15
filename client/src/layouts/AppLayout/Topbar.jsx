import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, Search, PanelLeftOpen, Download, ChevronDown, SquarePen, Settings, Zap, LogOut, Sun, Moon } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { useTheme } from '@/hooks/useTheme';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { IconButton } from '@/components/ui/IconButton';
import { Kbd } from '@/components/ui/Kbd';
import { Avatar } from '@/components/ui/Avatar';
import { Dropdown } from '@/components/ui/Dropdown';
import { useAuthStore } from '@/store/authStore';
import { useChatStore, AVAILABLE_MODELS, MORE_MODELS } from '@/store/chatStore';
import { ModelSelectorPopover } from '@/features/chat/ModelSelector';
import { ROUTES } from '@/constants/routes';
import styles from './Topbar.module.scss';

export function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isChatRoute = location.pathname.startsWith('/chat');

  const { isDark, toggleTheme } = useTheme();
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const setDrawerOpen = useUiStore((state) => state.setDrawerOpen);
  const isSidebarCollapsed = useUiStore((state) => state.isSidebarCollapsed);
  const toggleSidebarCollapsed = useUiStore((state) => state.toggleSidebarCollapsed);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const credits = user?.wallet?.creditsRemaining ?? 100;

  const { selectedModel, thinkingLevel, isStreaming, selectChat } = useChatStore();
  const [isModelPopoverOpen, setIsModelPopoverOpen] = useState(false);
  const modelButtonRef = useRef(null);

  const currentModelObj =
    AVAILABLE_MODELS.find((m) => m.id === selectedModel) ||
    MORE_MODELS.find((m) => m.id === selectedModel);
  const modelShortName = currentModelObj
    ? currentModelObj.name.replace('NexAI 2.5 ', '')
    : 'Flash';
  const effortName = thinkingLevel ? thinkingLevel.charAt(0).toUpperCase() + thinkingLevel.slice(1) : 'Medium';
  const modelPillLabel = `${modelShortName} ${effortName}`;

  const userDisplayName = user?.name || user?.email?.split('@')[0] || 'User';
  const userPlan =
    user?.role === 'admin'
      ? 'Admin'
      : user?.wallet?.plan === 'enterprise'
        ? 'Enterprise'
        : user?.wallet?.plan === 'pro'
          ? 'Pro'
          : 'Free';

  const profileMenuItems = [
    {
      header: true,
      label: `${userDisplayName} (${userPlan})`,
    },
    {
      label: 'Settings',
      icon: <Settings size={15} />,
      onClick: () => navigate(ROUTES.SETTINGS),
    },
    {
      label: `Wallet (${credits.toLocaleString()} tokens)`,
      icon: <Zap size={15} />,
      onClick: () => navigate(ROUTES.WALLET),
    },
    { divider: true },
    {
      label: isDark ? 'Light Theme' : 'Dark Theme',
      icon: isDark ? <Sun size={15} /> : <Moon size={15} />,
      onClick: toggleTheme,
    },
    { divider: true },
    {
      label: 'Sign Out',
      icon: <LogOut size={15} />,
      danger: true,
      onClick: async () => {
        await logout();
        navigate(ROUTES.LOGIN);
      },
    },
  ];

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
        {isSidebarCollapsed && (
          <div className={styles.desktopToggle}>
            <IconButton
              icon={<PanelLeftOpen size={18} />}
              label="Expand sidebar (Ctrl+B)"
              onClick={toggleSidebarCollapsed}
            />
          </div>
        )}

        {/* Topbar Model Selector — Primary mobile & chat placement (Gemini Benchmark) */}
        {isChatRoute && (
          <div className={styles.topbarModelWrapper}>
            <button
              ref={modelButtonRef}
              type="button"
              className={styles.topbarModelBtn}
              onClick={() => setIsModelPopoverOpen((prev) => !prev)}
              disabled={isStreaming}
              title={`AI Model: ${modelShortName} · Effort: ${effortName}`}
              aria-label="Select AI model and effort"
            >
              <span className={styles.modelName}>{modelPillLabel}</span>
              <ChevronDown size={13} className={styles.modelChevron} />
            </button>

            <ModelSelectorPopover
              open={isModelPopoverOpen}
              onClose={() => setIsModelPopoverOpen(false)}
              anchorRef={modelButtonRef}
              placement="bottom"
            />
          </div>
        )}

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
        {/* Mobile New Chat Button — Direct one-tap initiation (Gemini Benchmark) */}
        {isChatRoute && (
          <div className={styles.mobileNewChatBtn}>
            <IconButton
              icon={<SquarePen size={18} />}
              label="New Chat"
              onClick={() => {
                selectChat(null);
                navigate(ROUTES.CHAT);
              }}
            />
          </div>
        )}

        {isInstallable && !isInstalled && (
          <button
            type="button"
            className={styles.installPill}
            onClick={promptInstall}
            title="Install NexAI App"
            aria-label="Install NexAI App"
          >
            <Download size={14} />
            <span>Install</span>
          </button>
        )}

        {/* Profile Avatar Dropdown in Far Right Corner */}
        <Dropdown
          portal={true}
          align="right"
          trigger={
            <button
              type="button"
              className={styles.profileBtn}
              aria-label="User account menu"
              title={userDisplayName}
            >
              <Avatar name={userDisplayName} size="sm" />
            </button>
          }
          items={profileMenuItems}
        />
      </div>
    </header>
  );
}

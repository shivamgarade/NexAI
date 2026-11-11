import { useLocation } from 'react-router-dom';
import { Menu, Sun, Moon, MessageSquareDashed, MessageSquare } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { useTheme } from '@/hooks/useTheme';
import { useChatStore } from '@/store/chatStore';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/utils/cn';
import styles from './Topbar.module.scss';

export function Topbar() {
  const { isDark, toggleTheme } = useTheme();
  const setDrawerOpen = useUiStore((state) => state.setDrawerOpen);
  const location = useLocation();
  const {
    chats,
    activeChatId,
    isTemporaryChat,
    startTemporaryChat,
    clearTemporaryChat,
  } = useChatStore();

  const handleToggleTemporaryChat = () => {
    if (isTemporaryChat) {
      clearTemporaryChat();
    } else {
      startTemporaryChat();
    }
  };

  // Determine active conversation title on /chat/:id
  const isChatRoute = location.pathname.startsWith('/chat');
  const pathChatId = location.pathname.split('/')[2];
  const targetChatId = pathChatId || activeChatId;
  const currentChat = isChatRoute && targetChatId
    ? chats.find((c) => c._id === targetChatId)
    : null;

  const chatTitle = isTemporaryChat
    ? 'Temporary Chat'
    : currentChat?.title;

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

        {/* Floating Capsule for Active Chat Title on the same level */}
        {chatTitle && (
          <div className={cn(styles.chatTitleCapsule, isTemporaryChat && styles.temporaryCapsule)}>
            {isTemporaryChat ? (
              <MessageSquareDashed size={13} className={styles.capsuleIcon} />
            ) : (
              <MessageSquare size={13} className={styles.capsuleIcon} />
            )}
            <span className={styles.capsuleTitle} title={chatTitle}>
              {chatTitle}
            </span>
            {isTemporaryChat && (
              <span className={styles.tempCapsuleBadge}>Ephemeral</span>
            )}
          </div>
        )}
      </div>

      {/* Floating Separate Round Icons on the right */}
      <div className={styles.rightGroup}>
        {(isTemporaryChat || (!targetChatId && (isChatRoute || location.pathname === '/'))) && (
          <button
            type="button"
            onClick={handleToggleTemporaryChat}
            className={cn(styles.roundFloatingBtn, isTemporaryChat && styles.activeTempBtn)}
            title={isTemporaryChat ? 'Exit temporary chat' : 'Start temporary chat'}
            aria-label={isTemporaryChat ? 'Exit temporary chat' : 'Start temporary chat'}
          >
            <MessageSquareDashed size={16} />
          </button>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          className={styles.roundFloatingBtn}
          title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}

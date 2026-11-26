import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, MessageSquareDashed, Check } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { useChatStore } from '@/store/chatStore';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/utils/cn';
import styles from './Topbar.module.scss';

export function Topbar() {
  const setDrawerOpen = useUiStore((state) => state.setDrawerOpen);
  const location = useLocation();
  const {
    chats,
    activeChatId,
    isTemporaryChat,
    startTemporaryChat,
    clearTemporaryChat,
    updateChatTitle,
  } = useChatStore();

  const [isEditing, setIsEditing] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const justSavedTimerRef = useRef(null);
  const lastSavedTitleRef = useRef('');

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

  // Sync title input when currentChat changes or updates externally
  useEffect(() => {
    if (!isEditing && currentChat?.title) {
      setTitleInput(currentChat.title);
      lastSavedTitleRef.current = currentChat.title;
    }
  }, [currentChat?._id, currentChat?.title, isEditing]);

  // Reset editing mode when switching chats
  useEffect(() => {
    setIsEditing(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, [targetChatId]);

  // Focus and select input text when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (justSavedTimerRef.current) clearTimeout(justSavedTimerRef.current);
    };
  }, []);

  const saveTitle = useCallback(async (newTitle, exitEdit = false) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!currentChat?._id || isTemporaryChat) {
      if (exitEdit) setIsEditing(false);
      return;
    }

    const trimmed = (newTitle ?? '').trim();
    // If empty, revert to the last saved title
    if (!trimmed) {
      setTitleInput(lastSavedTitleRef.current);
      if (exitEdit) setIsEditing(false);
      return;
    }

    // If unchanged, do not trigger API call
    if (trimmed === lastSavedTitleRef.current) {
      if (exitEdit) setIsEditing(false);
      return;
    }

    const previousTitle = lastSavedTitleRef.current;
    lastSavedTitleRef.current = trimmed;
    if (exitEdit) {
      setIsEditing(false);
    }

    try {
      await updateChatTitle(currentChat._id, trimmed);
      setJustSaved(true);
      if (justSavedTimerRef.current) clearTimeout(justSavedTimerRef.current);
      justSavedTimerRef.current = setTimeout(() => {
        setJustSaved(false);
      }, 1500);
    } catch {
      // Revert on error
      lastSavedTitleRef.current = previousTitle;
      setTitleInput(previousTitle);
    }
  }, [currentChat?._id, isTemporaryChat, updateChatTitle]);

  const handleStartEditing = () => {
    if (isTemporaryChat || !currentChat) return;
    setTitleInput(currentChat.title || '');
    lastSavedTitleRef.current = currentChat.title || '';
    setIsEditing(true);
  };

  const handleTitleChange = (e) => {
    const val = e.target.value;
    setTitleInput(val);

    // Debounce auto-save after user stops typing for 1000ms
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      saveTitle(val, false);
    }, 1000);
  };

  const handleBlur = () => {
    saveTitle(titleInput, true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTitle(titleInput, true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      setTitleInput(lastSavedTitleRef.current);
      setIsEditing(false);
    }
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

        {/* In-place Editable Chat Title */}
        {chatTitle && (
          <div
            className={cn(
              styles.chatTitleWrap,
              isTemporaryChat && styles.temporaryTitle,
              !isTemporaryChat && currentChat && styles.isEditable,
              isEditing && styles.isEditing
            )}
            onClick={!isEditing && !isTemporaryChat && currentChat ? handleStartEditing : undefined}
            role={!isTemporaryChat && currentChat && !isEditing ? 'button' : undefined}
            tabIndex={!isTemporaryChat && currentChat && !isEditing ? 0 : undefined}
            onKeyDown={!isTemporaryChat && currentChat && !isEditing ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleStartEditing();
              }
            } : undefined}
            title={!isTemporaryChat && currentChat && !isEditing ? 'Click to rename chat' : undefined}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                className={styles.titleInput}
                value={titleInput}
                onChange={handleTitleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                maxLength={100}
                aria-label="Edit chat title"
              />
            ) : (
              <span className={styles.titleText} title={chatTitle}>
                {chatTitle}
              </span>
            )}

            {justSaved && (
              <Check size={13} className={styles.saveIndicator} title="Saved" aria-label="Saved" />
            )}

            {isTemporaryChat && (
              <span className={styles.tempBadge}>Ephemeral</span>
            )}
          </div>
        )}
      </div>

      {/* Right Group */}
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
      </div>
    </header>
  );
}

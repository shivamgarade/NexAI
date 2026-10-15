import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  MessageSquare,
  MessageSquareDashed,
  ChevronDown,
  Pin,
  Edit2,
  Trash2,
  Share2,
} from 'lucide-react';
import { Dropdown } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ChatHero, MessageThread, ChatInput } from '@/features/chat';
import { useChatStore } from '@/store/chatStore';
import { toast } from '@/store/uiStore';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils/cn';
import styles from './ChatPage.module.scss';

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    chats,
    isLoadingChats,
    activeChatId,
    fetchChats,
    selectChat,
    createChat,
    sendMessage,
    isTemporaryChat,
    clearTemporaryChat,
  } = useChatStore();

  const [prefillPrompt, setPrefillPrompt] = useState('');

  // Handle prefill prompt from navigation state (e.g. Prompt Vault "Use in Chat")
  useEffect(() => {
    if (location.state?.prefill) {
      setPrefillPrompt(location.state.prefill);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // Initial fetch of chats on mount
  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Synchronize route param chatId with activeChatId in store and redirect to new chat if not found
  useEffect(() => {
    let isCancelled = false;

    const syncRouteChat = async () => {
      if (chatId) {
        if (isTemporaryChat) return;

        // Skip redirect if this chat is already active in the store — it was just created
        // and hasn't propagated into the chats list yet (race condition guard)
        const currentActiveChatId = useChatStore.getState().activeChatId;
        if (currentActiveChatId === chatId) return;

        // If chats list is already loaded, check if chatId exists
        if (!isLoadingChats && chats.length > 0) {
          const exists = chats.some((c) => c._id === chatId);
          if (!exists) {
            navigate(ROUTES.CHAT, { replace: true });
            selectChat(null);
            return;
          }
        }

        const success = await selectChat(chatId);
        if (!isCancelled && success === false) {
          navigate(ROUTES.CHAT, { replace: true });
          selectChat(null);
        }
      } else {
        const currentStoreChatId = useChatStore.getState().activeChatId;
        if (currentStoreChatId) {
          selectChat(null);
        }
      }
    };

    syncRouteChat();

    return () => {
      isCancelled = true;
    };
  }, [chatId, chats, isLoadingChats, isTemporaryChat, navigate, selectChat]);

  // Cleanup temporary chat when user leaves chat page
  useEffect(() => {
    return () => {
      const store = useChatStore.getState();
      if (store.isTemporaryChat && store.activeChatId) {
        store.clearTemporaryChat();
      }
    };
  }, []);

  const handleSendFromHero = async (prompt, attachments = []) => {
    const isTemp = useChatStore.getState().isTemporaryChat;
    const newChat = await createChat(
      isTemp ? { title: 'Temporary Chat', isTemporary: true } : 'New Chat',
    );
    if (!newChat) return;

    navigate(`/chat/${newChat._id}`, { replace: true });
    sendMessage(prompt, attachments, { chatId: newChat._id });
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentChat = chats.find((c) => c._id === (chatId || activeChatId));
  const pageTitle = isTemporaryChat
    ? 'Temporary Chat'
    : currentChat
      ? currentChat.title
      : 'AI Chat';

  const isPinned = Boolean(
    currentChat &&
      (() => {
        try {
          return JSON.parse(localStorage.getItem('nexai_pinned_chats') || '[]').includes(
            currentChat._id,
          );
        } catch {
          return false;
        }
      })(),
  );

  const togglePin = () => {
    if (!currentChat) return;
    try {
      const saved = JSON.parse(localStorage.getItem('nexai_pinned_chats') || '[]');
      const next = saved.includes(currentChat._id)
        ? saved.filter((id) => id !== currentChat._id)
        : [currentChat._id, ...saved];
      localStorage.setItem('nexai_pinned_chats', JSON.stringify(next));
      window.dispatchEvent(new Event('storage'));
      toast.info(next.includes(currentChat._id) ? 'Chat pinned' : 'Chat unpinned');
    } catch {
      // Ignore
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Chat link copied to clipboard!');
    } catch {
      toast.info('Link ready to share');
    }
  };

  const handleRename = async () => {
    if (!currentChat) return;
    const newTitle = window.prompt('Rename conversation', currentChat.title);
    if (newTitle && newTitle.trim()) {
      await useChatStore.getState().updateChatTitle(currentChat._id, newTitle.trim());
      toast.success('Title updated');
    }
  };

  const handleDelete = async () => {
    if (!currentChat) return;
    setIsDeleting(true);
    await useChatStore.getState().deleteChat(currentChat._id);
    setIsDeleting(false);
    setShowDeleteConfirm(false);
    navigate(ROUTES.CHAT);
  };

  const chatMenuItems = currentChat
    ? [
        {
          label: isPinned ? 'Unpin' : 'Pin',
          icon: <Pin size={13} />,
          trailing: 'P',
          onClick: togglePin,
        },
        {
          label: 'Rename',
          icon: <Edit2 size={13} />,
          trailing: 'R',
          onClick: handleRename,
        },
        {
          label: 'Share chat',
          icon: <Share2 size={13} />,
          onClick: handleShare,
        },
        { divider: true },
        {
          label: 'Delete',
          icon: <Trash2 size={13} />,
          trailing: 'D',
          danger: true,
          onClick: () => setShowDeleteConfirm(true),
        },
      ]
    : [];

  // Hero view is only shown on the base /chat route when no chat session is active
  const isHeroView = !chatId;

  return (
    <div
      className={cn(styles.chatContainer, isTemporaryChat && styles.temporaryChatTheme)}
      data-testid="chat-page"
    >
      {isHeroView ? (
        <ChatHero
          onSendPrompt={handleSendFromHero}
          initialPrompt={prefillPrompt}
          onClearInitialPrompt={() => setPrefillPrompt('')}
        />
      ) : (
        <div className={styles.activeWorkspace}>
          {/* Active Conversation Header (Claude Style) */}
          <header className={styles.chatHeader}>
            <div className={styles.headerLeft}>
              {currentChat && !isTemporaryChat ? (
                <Dropdown
                  trigger={
                    <button
                      type="button"
                      className={styles.titleDropdownBtn}
                      aria-label="Conversation options"
                    >
                      <h1 className={styles.titleText}>{pageTitle}</h1>
                      <ChevronDown size={14} className={styles.titleChevron} />
                    </button>
                  }
                  items={chatMenuItems}
                  align="left"
                  portal={true}
                />
              ) : (
                <div className={styles.titleInfo}>
                  {isTemporaryChat ? (
                    <MessageSquareDashed size={16} className={styles.tempTitleIcon} />
                  ) : (
                    <MessageSquare size={16} className={styles.titleIcon} />
                  )}
                  <h1 className={styles.titleText}>{pageTitle}</h1>
                </div>
              )}
            </div>

            <div className={styles.headerRight}>
              {isTemporaryChat ? (
                <button
                  type="button"
                  className={styles.tempHeaderExitBtn}
                  onClick={async () => {
                    await clearTemporaryChat();
                    navigate(ROUTES.CHAT);
                  }}
                  title="Exit temporary chat and return to normal mode"
                >
                  Exit Temporary Mode
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.shareButton}
                  onClick={handleShare}
                  aria-label="Share chat"
                >
                  <Share2 size={13} />
                  <span>Share</span>
                </button>
              )}
            </div>
          </header>

          <ConfirmDialog
            open={showDeleteConfirm}
            title="Delete conversation?"
            description="This will permanently delete this conversation and all its messages. This action cannot be undone."
            confirmLabel="Delete"
            cancelLabel="Cancel"
            tone="danger"
            loading={isDeleting}
            onConfirm={handleDelete}
            onCancel={() => setShowDeleteConfirm(false)}
          />


          {/* Full-width conversation canvas */}
          <div className={styles.threadArea}>
            <MessageThread
              onSelectSuggestion={(prompt) => sendMessage(prompt)}
              onEditPrompt={(prompt) => setPrefillPrompt(prompt)}
            />
          </div>

          {/* Pinned bottom composer */}
          <div className={styles.inputArea}>
            <ChatInput prefillValue={prefillPrompt} onClearPrefill={() => setPrefillPrompt('')} />
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, MessageSquareDashed } from 'lucide-react';
import { ChatHero, MessageThread, ChatInput } from '@/features/chat';
import { useChatStore } from '@/store/chatStore';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils/cn';
import styles from './ChatPage.module.scss';

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    chats,
    activeChatId,
    messages,
    isLoadingMessages,
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


  // Synchronize route param chatId with activeChatId in store
  useEffect(() => {
    const currentStoreChatId = useChatStore.getState().activeChatId;
    if (chatId) {
      if (chatId !== currentStoreChatId) {
        selectChat(chatId);
      }
    } else {
      if (currentStoreChatId) {
        selectChat(null);
      }
    }
  }, [chatId, selectChat]);

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
    if (newChat) {
      navigate(`/chat/${newChat._id}`, { replace: true });
    }
    await sendMessage(prompt, attachments);
  };

  const currentChat = chats.find((c) => c._id === (chatId || activeChatId));
  const pageTitle = isTemporaryChat
    ? 'Temporary Chat'
    : currentChat
      ? currentChat.title
      : 'AI Chat';

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

          {/* Active Conversation Header */}
          <header className={styles.chatHeader}>
            <div className={styles.headerLeft}>
              <div className={styles.titleInfo}>
                {isTemporaryChat ? (
                  <MessageSquareDashed size={16} className={styles.tempTitleIcon} />
                ) : (
                  <MessageSquare size={16} className={styles.titleIcon} />
                )}
                <h1 className={styles.titleText}>{pageTitle}</h1>
              </div>
            </div>
            {isTemporaryChat && (
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
            )}
          </header>

          {/* Ephemeral alert banner for active temporary chat thread */}
          {isTemporaryChat && (
            <div className={styles.temporaryChatBanner}>
              <MessageSquareDashed size={14} className={styles.tempBannerIcon} />
              <span className={styles.tempBannerText}>
                <strong>Temporary Chat Active:</strong> Messages will not appear in recent history and will vanish when you leave.
              </span>
            </div>
          )}

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

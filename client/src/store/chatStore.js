import { create } from 'zustand';
import { chatApi } from '@/lib/api/chat.api.js';
import { streamChatMessage, sanitizeErrorMessage } from '@/lib/sse.js';
import { useAuthStore } from './authStore.js';
import { useWalletStore } from './walletStore.js';
import { toast } from './uiStore.js';

export const useChatStore = create((set, get) => ({
  chats: [],
  activeChatId: null,
  messages: [],
  isLoadingChats: false,
  isLoadingMessages: false,
  isStreaming: false,
  abortController: null,
  error: null,
  insufficientCredits: false,
  selectedModel: 'flash',
  thinkingLevel: 'medium',
  activeDrawerThought: null,
  isSimulation: false,

  /**
   * Set the AI model to use (flash or pro)
   * @param {'flash' | 'pro'} model
   */
  setSelectedModel: (model) => set({ selectedModel: model }),

  /**
   * Set the AI thinking / reasoning depth
   * @param {'off' | 'low' | 'medium' | 'high'} level
   */
  setThinkingLevel: (level) => set({ thinkingLevel: level }),

  /**
   * Set active thought text to view in the slide-over drawer
   * @param {string | null} thought
   */
  setActiveDrawerThought: (thought) => set({ activeDrawerThought: thought }),

  /**
   * Toggle zero-token simulation mode
   */
  toggleSimulation: () =>
    set((state) => {
      const next = !state.isSimulation;
      toast.info(
        next
          ? '🎮 Simulation Mode Active (0 Gemini tokens consumed)'
          : '⚡ Live Gemini AI Mode Active',
      );
      return { isSimulation: next };
    }),

  setIsSimulation: (isSimulation) => set({ isSimulation }),

  /**
   * Fetch all user chat sessions
   */
  fetchChats: async () => {
    set({ isLoadingChats: true, error: null });
    try {
      const response = await chatApi.getChats();
      const chats = response.data || [];
      set({ chats, isLoadingChats: false });
      return chats;
    } catch (err) {
      const message = err.message || 'Failed to load chats';
      set({ isLoadingChats: false, error: message });
      toast.error(message);
      return [];
    }
  },

  /**
   * Create a new chat session
   * @param {string | { title?: string, projectId?: string }} [options]
   */
  createChat: async (options = 'New Chat') => {
    try {
      const payload = typeof options === 'string' ? { title: options } : options;
      const response = await chatApi.createChat(payload);
      const newChat = response.data;
      set((state) => ({
        chats: [newChat, ...state.chats],
        activeChatId: newChat._id,
        messages: [],
        error: null,
        insufficientCredits: false,
      }));
      return newChat;
    } catch (err) {
      const message = err.message || 'Failed to create chat';
      set({ error: message });
      toast.error(message);
      return null;
    }
  },

  /**
   * Select a chat and load its messages
   * @param {string} chatId
   */
  selectChat: async (chatId) => {
    if (get().activeChatId === chatId) {
      return;
    }

    // Abort active stream if user switches chat
    if (get().isStreaming && get().abortController) {
      get().abortController.abort();
    }

    set({
      activeChatId: chatId,
      messages: [],
      isStreaming: false,
      abortController: null,
      error: null,
    });

    if (chatId) {
      await get().fetchMessages(chatId);
    }
  },

  /**
   * Update chat details (title, projectId, pinned)
   * @param {string} chatId
   * @param {string | { title?: string, projectId?: string, pinned?: boolean }} payload
   */
  updateChatDetails: async (chatId, payload) => {
    try {
      const response = await chatApi.updateChat(chatId, payload);
      const updatedChat = response.data;
      set((state) => ({
        chats: state.chats.map((c) => (c._id === chatId ? updatedChat : c)),
      }));
      return updatedChat;
    } catch (err) {
      const message = err.message || 'Failed to update chat';
      toast.error(message);
      return null;
    }
  },

  /**
   * Update chat title
   * @param {string} chatId
   * @param {string} title
   */
  updateChatTitle: async (chatId, title) => {
    return get().updateChatDetails(chatId, title);
  },

  /**
   * Move chat to a project or remove from project (null)
   * @param {string} chatId
   * @param {string | null} projectId
   */
  moveChatToProject: async (chatId, projectId) => {
    try {
      const response = await chatApi.updateChat(chatId, { projectId });
      const updatedChat = response.data;
      set((state) => ({
        chats: state.chats.map((c) => (c._id === chatId ? updatedChat : c)),
      }));
      toast.success(projectId ? 'Chat moved to project' : 'Chat removed from project');
      return updatedChat;
    } catch (err) {
      const message = err.message || 'Failed to move chat';
      toast.error(message);
      return null;
    }
  },

  /**
   * Delete a chat and its messages
   * @param {string} chatId
   */
  deleteChat: async (chatId) => {
    try {
      await chatApi.deleteChat(chatId);
      set((state) => {
        const remainingChats = state.chats.filter((c) => c._id !== chatId);
        const nextActiveId =
          state.activeChatId === chatId
            ? remainingChats.length > 0
              ? remainingChats[0]._id
              : null
            : state.activeChatId;

        return {
          chats: remainingChats,
          activeChatId: nextActiveId,
          messages: state.activeChatId === chatId ? [] : state.messages,
        };
      });

      // Load messages for the next active chat if switched
      const currentActiveId = get().activeChatId;
      if (currentActiveId) {
        get().fetchMessages(currentActiveId);
      }
      return true;
    } catch (err) {
      const message = err.message || 'Failed to delete chat';
      toast.error(message);
      return false;
    }
  },

  /**
   * Delete multiple chats and their messages
   * @param {string[]} chatIds
   */
  deleteMultipleChats: async (chatIds) => {
    if (!chatIds || chatIds.length === 0) return true;
    try {
      await Promise.all(chatIds.map((id) => chatApi.deleteChat(id)));
      set((state) => {
        const remainingChats = state.chats.filter((c) => !chatIds.includes(c._id));
        const nextActiveId = chatIds.includes(state.activeChatId)
          ? remainingChats.length > 0
            ? remainingChats[0]._id
            : null
          : state.activeChatId;

        return {
          chats: remainingChats,
          activeChatId: nextActiveId,
          messages: chatIds.includes(state.activeChatId) ? [] : state.messages,
        };
      });

      const currentActiveId = get().activeChatId;
      if (currentActiveId) {
        get().fetchMessages(currentActiveId);
      }
      toast.success(
        chatIds.length === 1
          ? 'Conversation deleted successfully'
          : `Deleted ${chatIds.length} conversations`,
      );
      return true;
    } catch (err) {
      const message = err.message || 'Failed to delete selected conversations';
      toast.error(message);
      return false;
    }
  },

  /**
   * Fetch messages for a specific chat
   * @param {string} chatId
   */
  fetchMessages: async (chatId) => {
    set({ isLoadingMessages: true, error: null });
    try {
      const response = await chatApi.getMessages(chatId);
      const messages = response.data || [];
      // Only set messages if the user hasn't switched to another chat while fetching
      if (get().activeChatId === chatId) {
        set({ messages, isLoadingMessages: false });
      }
      return messages;
    } catch (err) {
      const message = err.message || 'Failed to load messages';
      set({ isLoadingMessages: false, error: message });
      toast.error(message);
      return [];
    } finally {
      // Ensure loading flag is never left true
      set({ isLoadingMessages: false });
    }
  },

  /**
   * Send a message and stream the assistant response
   * @param {string} content
   */
  sendMessage: async (content, attachments = []) => {
    const trimmed = content.trim();
    if (!trimmed || get().isStreaming) {
      return;
    }

    let targetChatId = get().activeChatId;

    // Auto-create chat session if none is selected
    if (!targetChatId) {
      const newChat = await get().createChat('New Chat');
      if (!newChat) {
        return;
      }
      targetChatId = newChat._id;
    }

    const optimisticUserId = `temp-user-${Date.now()}`;
    const optimisticAssistantId = `temp-assistant-${Date.now()}`;

    const userMessage = {
      _id: optimisticUserId,
      chatId: targetChatId,
      role: 'user',
      content: trimmed,
      attachments: Array.isArray(attachments) ? attachments : [],
      createdAt: new Date().toISOString(),
    };

    const assistantMessage = {
      _id: optimisticAssistantId,
      chatId: targetChatId,
      role: 'assistant',
      content: '',
      thoughts: '',
      isThinking: get().thinkingLevel !== 'off',
      isStreaming: true,
      createdAt: new Date().toISOString(),
    };

    const abortController = new AbortController();

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isStreaming: true,
      isLoadingMessages: false,
      abortController,
      error: null,
    }));

    try {
      const model = get().selectedModel;
      const thinkingLevel = get().thinkingLevel;
      const isSimulation = get().isSimulation;

      await streamChatMessage({
        chatId: targetChatId,
        content: trimmed,
        model,
        thinkingLevel,
        attachments,
        isSimulation,
        signal: abortController.signal,
        onThought: (text) => {
          set((state) => {
            const msgs = [...state.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              msgs[msgs.length - 1] = {
                ...lastMsg,
                thoughts: (lastMsg.thoughts || '') + text,
                isThinking: true,
              };
            }
            return { messages: msgs };
          });
        },
        onToken: (text) => {
          set((state) => {
            const msgs = [...state.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              msgs[msgs.length - 1] = {
                ...lastMsg,
                content: (lastMsg.content || '') + text,
                isThinking: false,
              };
            }
            return { messages: msgs };
          });
        },
        onDone: (doneData) => {
          set((state) => {
            const msgs = [...state.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              msgs[msgs.length - 1] = {
                ...lastMsg,
                _id: doneData.messageId || lastMsg._id,
                thoughts: doneData.thoughts || lastMsg.thoughts || '',
                tokensUsed: doneData.tokensUsed,
                followUps: doneData.followUps || [],
                isStreaming: false,
                isThinking: false,
              };
            }

            let updatedChats = state.chats;
            if (doneData.chatTitle) {
              updatedChats = state.chats.map((c) =>
                c._id === targetChatId
                  ? { ...c, title: doneData.chatTitle, updatedAt: new Date().toISOString() }
                  : c,
              );
            }

            return {
              messages: msgs,
              chats: updatedChats,
              isStreaming: false,
              abortController: null,
            };
          });

          // Sync credit balance and live quota governance reactively across stores
          if (typeof doneData.creditsRemaining === 'number') {
            useAuthStore.getState().updateCredits(doneData.creditsRemaining);
            const currentWallet = useWalletStore.getState().wallet;
            if (currentWallet) {
              useWalletStore.setState({
                wallet: { ...currentWallet, creditsRemaining: doneData.creditsRemaining },
              });
            }
          }
          if (doneData.governance) {
            useWalletStore.getState().setGovernance(doneData.governance);
          }
        },
        onError: (err) => {
          const is402 = err.status === 402 || err.code === 'INSUFFICIENT_CREDITS';
          const cleanMessage = sanitizeErrorMessage(err.message || 'Stream error occurred');

          set((state) => {
            const msgs = [...state.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              msgs[msgs.length - 1] = {
                ...lastMsg,
                isStreaming: false,
                error: cleanMessage,
              };
            }

            return {
              messages: msgs,
              isStreaming: false,
              abortController: null,
              insufficientCredits: is402 ? true : state.insufficientCredits,
              error: cleanMessage,
            };
          });

          if (err.name !== 'AbortError') {
            toast.error(cleanMessage);
          }
        },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        const is402 = err.status === 402 || err.code === 'INSUFFICIENT_CREDITS';
        const cleanMessage = sanitizeErrorMessage(err.message || 'Failed to send message');

        set((state) => {
          const msgs = [...state.messages];
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            msgs[msgs.length - 1] = { ...lastMsg, isStreaming: false };
          }
          return {
            messages: msgs,
            isStreaming: false,
            abortController: null,
            insufficientCredits: is402 ? true : state.insufficientCredits,
            error: cleanMessage,
          };
        });

        toast.error(cleanMessage);
      }
    }
  },

  /**
   * Abort the active response generation
   */
  stopGeneration: () => {
    const { abortController, isStreaming } = get();
    if (isStreaming && abortController) {
      abortController.abort();
      set((state) => {
        const msgs = [...state.messages];
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          msgs[msgs.length - 1] = { ...lastMsg, isStreaming: false };
        }
        return {
          messages: msgs,
          isStreaming: false,
          abortController: null,
        };
      });
    }
  },

  /**
   * Resend a prompt, cleaning up an errored assistant message if one is currently at the end
   * @param {string} content
   */
  resendPrompt: async (content) => {
    set((state) => {
      const msgs = [...state.messages];
      if (msgs.length > 0 && msgs[msgs.length - 1].error) {
        msgs.pop();
      }
      return { messages: msgs };
    });
    await get().sendMessage(content);
  },

  /**
   * Reset the insufficient credits state
   */
  resetInsufficientCredits: () => set({ insufficientCredits: false }),

  /**
   * Clear error state
   */
  clearError: () => set({ error: null }),
}));

import { create } from 'zustand';
import { chatApi } from '@/lib/api/chat.api.js';
import { streamChatMessage, sanitizeErrorMessage } from '@/lib/sse.js';
import { speakText, cancelSpeech } from '@/lib/utils/speechSynthesis.js';
import { useAuthStore } from './authStore.js';
import { useWalletStore } from './walletStore.js';
import { useSkillStore } from './skillStore.js';
import { toast } from './uiStore.js';

export const AVAILABLE_MODELS = [
  {
    id: 'fable-5-1',
    name: 'Fable 5.1',
    tagline: 'For your toughest challenges',
    badge: 'Pro or Max',
    tierRequired: 'Max',
    isLive: false,
    backendModel: 'pro',
  },
  {
    id: 'opus-5-5',
    name: 'Opus 5.5',
    tagline: 'For complex work and everyday tasks',
    badge: 'Pro',
    tierRequired: 'Pro',
    isLive: false,
    backendModel: 'pro',
  },
  {
    id: 'sonnet-5-5',
    name: 'Sonnet 5.5',
    tagline: 'Most efficient for simpler tasks',
    badge: 'Live',
    isLive: true,
    backendModel: 'pro',
  },
  {
    id: 'haiku-5-5',
    name: 'Haiku 5.5',
    tagline: 'Fastest for quick answers',
    badge: 'Fast',
    isLive: true,
    backendModel: 'flash',
  },
  {
    id: 'pro',
    name: 'NexAI 2.5 Pro',
    tagline: 'Deep analytical reasoning for code & architecture',
    badge: 'Live · Pro',
    isLive: true,
    backendModel: 'pro',
  },
  {
    id: 'flash',
    name: 'NexAI 2.5 Flash',
    tagline: 'Ultra-fast multimodal reasoning engine',
    badge: 'Live · Free',
    isLive: true,
    backendModel: 'flash',
  },
];

export const MORE_MODELS = [
  { id: 'fable-5', name: 'Fable 5', badge: 'Pro or Max', tierRequired: 'Max', backendModel: 'pro' },
  { id: 'opus-5', name: 'Opus 5', badge: 'Pro', tierRequired: 'Pro', backendModel: 'pro' },
  { id: 'opus-4-8', name: 'Opus 4.8', badge: 'Pro', tierRequired: 'Pro', backendModel: 'pro' },
  { id: 'opus-4-7', name: 'Opus 4.7', badge: 'Pro', tierRequired: 'Pro', backendModel: 'pro' },
  { id: 'opus-4-6', name: 'Opus 4.6', badge: 'Pro', tierRequired: 'Pro', backendModel: 'pro' },
  { id: 'opus-3', name: 'Opus 3', badge: 'Pro', tierRequired: 'Pro', backendModel: 'pro' },
  { id: 'sonnet-5', name: 'Sonnet 5', badge: '', backendModel: 'flash' },
  { id: 'sonnet-4-6', name: 'Sonnet 4.6', badge: '', backendModel: 'flash' },
  { id: 'haiku-4-5', name: 'Haiku 4.5', badge: '', backendModel: 'flash' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', badge: 'Reasoning', backendModel: 'pro' },
  { id: 'gpt-4o', name: 'GPT-4o', badge: 'Omni', backendModel: 'flash' },
];

export const EFFORT_LEVELS = [
  { id: 'low', name: 'Low', description: '' },
  { id: 'medium', name: 'Medium', badge: 'Recommended', description: '' },
  { id: 'high', name: 'High', description: '' },
  { id: 'extra', name: 'Extra', description: '' },
  { id: 'max', name: 'Max', warning: '5x or more usage', description: '' },
];

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
  isTemporaryChat: false,
  isVoiceMode: false,
  isAiSpeaking: false,

  /**
   * Toggle real-time voice-to-voice conversation mode
   */
  toggleVoiceMode: () => {
    const next = !get().isVoiceMode;
    if (!next) {
      get().cancelAiSpeech();
    }
    set({ isVoiceMode: next });
  },

  setVoiceMode: (val) => {
    const next = Boolean(val);
    if (!next) {
      get().cancelAiSpeech();
    }
    set({ isVoiceMode: next });
  },

  speakAiResponse: (text) => {
    if (!get().isVoiceMode || !text) return;
    get().cancelAiSpeech();
    speakText(text, {
      onStart: () => set({ isAiSpeaking: true }),
      onEnd: () => set({ isAiSpeaking: false }),
      onError: () => set({ isAiSpeaking: false }),
    });
  },

  cancelAiSpeech: () => {
    cancelSpeech();
    set({ isAiSpeaking: false });
  },

  /**
   * Set the AI model to use
   * @param {string} model
   */
  setSelectedModel: (model) => {
    const modelObj = AVAILABLE_MODELS.find((m) => m.id === model);
    if (modelObj && !modelObj.isLive) {
      toast.info(`⚡ ${modelObj.name} preview active (routed via NexAI engine)`);
    }
    set({ selectedModel: model });
  },

  /**
   * Start an ephemeral Temporary Chat session (zero persistence)
   */
  startTemporaryChat: async () => {
    const currentActiveId = get().activeChatId;
    const wasTemporary = get().isTemporaryChat;
    if (wasTemporary && currentActiveId) {
      chatApi.deleteChat(currentActiveId).catch(() => {});
    }
    set({
      isTemporaryChat: true,
      activeChatId: null,
      messages: [],
      error: null,
      insufficientCredits: false,
    });
  },

  /**
   * Discard and purge temporary chat session
   */
  clearTemporaryChat: async () => {
    const currentActiveId = get().activeChatId;
    if (get().isTemporaryChat && currentActiveId) {
      await chatApi.deleteChat(currentActiveId).catch(() => {});
    }
    set({
      isTemporaryChat: false,
      activeChatId: null,
      messages: [],
    });
  },

  /**
   * Set Temporary Chat flag
   * @param {boolean} isTemporary
   */
  setIsTemporaryChat: (isTemporary) => set({ isTemporaryChat: isTemporary }),

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
   * @param {string | { title?: string, projectId?: string, isTemporary?: boolean }} [options]
   */
  createChat: async (options = 'New Chat') => {
    try {
      const isTemp = get().isTemporaryChat;
      let payload = typeof options === 'string' ? { title: options } : options || {};
      if (isTemp) {
        payload = { ...payload, isTemporary: true, title: payload.title || 'Temporary Chat' };
      }
      const response = await chatApi.createChat(payload);
      const newChat = response.data;
      set((state) => ({
        chats: isTemp ? state.chats : [newChat, ...state.chats],
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
    const prevActiveId = get().activeChatId;
    const wasTemp = get().isTemporaryChat;

    if (prevActiveId === chatId) {
      return;
    }

    // Abort active stream if user switches chat
    if (get().isStreaming && get().abortController) {
      get().abortController.abort();
    }

    // Ephemeral purge: If previous session was temporary, delete from DB immediately
    if (wasTemp && prevActiveId && prevActiveId !== chatId) {
      chatApi.deleteChat(prevActiveId).catch(() => {});
      set({ isTemporaryChat: false });
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
  sendMessage: async (content, attachments = [], options = {}) => {
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

    // Guard against callers accidentally passing a model string as second argument
    let safeAttachments = Array.isArray(attachments) ? attachments : [];
    let overrideModel = null;
    if (typeof attachments === 'string' && ['flash', 'pro'].includes(attachments)) {
      overrideModel = attachments;
      safeAttachments = [];
    }

    const activeSkill = options.skill || useSkillStore.getState().activeSkill;
    const skillId = options.skillId || activeSkill?._id || null;
    const enabledTools = options.enabledTools || activeSkill?.tools || [];

    const optimisticUserId = `temp-user-${Date.now()}`;
    const optimisticAssistantId = `temp-assistant-${Date.now()}`;

    const userMessage = {
      _id: optimisticUserId,
      chatId: targetChatId,
      role: 'user',
      content: trimmed,
      attachments: safeAttachments,
      createdAt: new Date().toISOString(),
    };

    const assistantMessage = {
      _id: optimisticAssistantId,
      chatId: targetChatId,
      role: 'assistant',
      content: '',
      thoughts: '',
      steps: [],
      groundingMetadata: null,
      skillId,
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
      const rawModel = overrideModel || get().selectedModel;
      const modelConfig = AVAILABLE_MODELS.find((m) => m.id === rawModel);
      const model = modelConfig?.backendModel || (['flash', 'pro'].includes(rawModel) ? rawModel : 'flash');
      const thinkingLevel = get().thinkingLevel;
      const isSimulation = get().isSimulation;

      await streamChatMessage({
        chatId: targetChatId,
        content: trimmed,
        model,
        thinkingLevel,
        attachments: safeAttachments,
        isSimulation,
        skillId,
        enabledTools,
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
        onStep: (step) => {
          set((state) => {
            const msgs = [...state.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              const existingSteps = Array.isArray(lastMsg.steps) ? [...lastMsg.steps] : [];
              const idx = existingSteps.findIndex((s) => s.id && s.id === step.id);
              if (idx >= 0) {
                existingSteps[idx] = { ...existingSteps[idx], ...step };
              } else {
                existingSteps.push(step);
              }
              msgs[msgs.length - 1] = {
                ...lastMsg,
                steps: existingSteps,
              };
            }
            return { messages: msgs };
          });
        },
        onGrounding: (grounding) => {
          set((state) => {
            const msgs = [...state.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              msgs[msgs.length - 1] = {
                ...lastMsg,
                groundingMetadata: grounding,
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
                steps: doneData.steps || lastMsg.steps || [],
                groundingMetadata: doneData.groundingMetadata || lastMsg.groundingMetadata || null,
                skillId: doneData.skillId || skillId,
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

          // Real-time Voice Conversation: Readout assistant response if voice mode is on
          const finalAssistantMsg = get().messages[get().messages.length - 1];
          if (get().isVoiceMode && finalAssistantMsg && finalAssistantMsg.content) {
            get().speakAiResponse(finalAssistantMsg.content);
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
    get().cancelAiSpeech();
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
   * Regenerate assistant response in-place without duplicating the user prompt.
   * @param {number} [targetIndex] - Optional index of the user or assistant message being regenerated/retried
   */
  regenerateResponse: async (targetIndex) => {
    if (get().isStreaming) return;

    const msgs = [...get().messages];
    if (msgs.length === 0) return;

    let userMsg = null;
    let assistantMsgIndex = -1;

    if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex < msgs.length) {
      const target = msgs[targetIndex];
      if (target.role === 'assistant') {
        assistantMsgIndex = targetIndex;
        // Find the preceding user message
        for (let i = targetIndex - 1; i >= 0; i--) {
          if (msgs[i].role === 'user') {
            userMsg = msgs[i];
            break;
          }
        }
      } else if (target.role === 'user') {
        userMsg = target;
        // Check if there is already an assistant message immediately following it
        if (targetIndex + 1 < msgs.length && msgs[targetIndex + 1].role === 'assistant') {
          assistantMsgIndex = targetIndex + 1;
        }
      }
    } else {
      // Default: check the end of the conversation
      const last = msgs[msgs.length - 1];
      if (last.role === 'assistant') {
        assistantMsgIndex = msgs.length - 1;
        for (let i = msgs.length - 2; i >= 0; i--) {
          if (msgs[i].role === 'user') {
            userMsg = msgs[i];
            break;
          }
        }
      } else if (last.role === 'user') {
        userMsg = last;
      }
    }

    if (!userMsg) return;

    const targetChatId = get().activeChatId;
    if (!targetChatId) return;

    const optimisticAssistantId = `temp-assistant-${Date.now()}`;
    const activeSkill = useSkillStore.getState().activeSkill;
    const skillId = activeSkill?._id || userMsg.skillId || null;
    const enabledTools = activeSkill?.tools || [];

    const blankAssistantMessage = {
      _id: optimisticAssistantId,
      chatId: targetChatId,
      role: 'assistant',
      content: '',
      thoughts: '',
      steps: [],
      groundingMetadata: null,
      skillId,
      isThinking: get().thinkingLevel !== 'off',
      isStreaming: true,
      createdAt: new Date().toISOString(),
    };

    let updatedMessages = [...msgs];
    if (assistantMsgIndex >= 0) {
      updatedMessages[assistantMsgIndex] = blankAssistantMessage;
    } else {
      const userIndex = msgs.indexOf(userMsg);
      if (userIndex >= 0) {
        updatedMessages = [
          ...msgs.slice(0, userIndex + 1),
          blankAssistantMessage,
        ];
      } else {
        updatedMessages.push(blankAssistantMessage);
      }
    }

    const abortController = new AbortController();

    set({
      messages: updatedMessages,
      isStreaming: true,
      isLoadingMessages: false,
      abortController,
      error: null,
    });

    try {
      const rawModel = get().selectedModel;
      const modelConfig = AVAILABLE_MODELS.find((m) => m.id === rawModel);
      const model = modelConfig?.backendModel || (['flash', 'pro'].includes(rawModel) ? rawModel : 'flash');
      const thinkingLevel = get().thinkingLevel;
      const isSimulation = get().isSimulation;

      await streamChatMessage({
        chatId: targetChatId,
        content: userMsg.content,
        model,
        thinkingLevel,
        attachments: userMsg.attachments || [],
        isSimulation,
        skillId,
        enabledTools,
        regenerate: true,
        signal: abortController.signal,
        onThought: (text) => {
          set((state) => {
            const next = [...state.messages];
            const idx = next.findIndex((m) => m._id === optimisticAssistantId);
            if (idx !== -1) {
              next[idx] = {
                ...next[idx],
                thoughts: (next[idx].thoughts || '') + text,
              };
            }
            return { messages: next };
          });
        },
        onToken: (token) => {
          set((state) => {
            const next = [...state.messages];
            const idx = next.findIndex((m) => m._id === optimisticAssistantId);
            if (idx !== -1) {
              next[idx] = {
                ...next[idx],
                content: (next[idx].content || '') + token,
                isThinking: false,
              };
            }
            return { messages: next };
          });
        },
        onStep: (step) => {
          set((state) => {
            const next = [...state.messages];
            const idx = next.findIndex((m) => m._id === optimisticAssistantId);
            if (idx !== -1) {
              const currentSteps = next[idx].steps || [];
              const stepIdx = currentSteps.findIndex((s) => s.id === step.id);
              let updatedSteps;
              if (stepIdx !== -1) {
                updatedSteps = [...currentSteps];
                updatedSteps[stepIdx] = { ...updatedSteps[stepIdx], ...step };
              } else {
                updatedSteps = [...currentSteps, step];
              }
              next[idx] = { ...next[idx], steps: updatedSteps };
            }
            return { messages: next };
          });
        },
        onGrounding: (groundingMetadata) => {
          set((state) => {
            const next = [...state.messages];
            const idx = next.findIndex((m) => m._id === optimisticAssistantId);
            if (idx !== -1) {
              next[idx] = { ...next[idx], groundingMetadata };
            }
            return { messages: next };
          });
        },
        onDone: (data) => {
          set((state) => {
            const next = [...state.messages];
            const idx = next.findIndex((m) => m._id === optimisticAssistantId);
            if (idx !== -1) {
              next[idx] = {
                ...next[idx],
                _id: data.messageId || optimisticAssistantId,
                tokensUsed: data.tokensUsed || 0,
                skillId: data.skillId || next[idx].skillId,
                steps: data.steps || next[idx].steps || [],
                groundingMetadata: data.groundingMetadata || next[idx].groundingMetadata || null,
                isThinking: false,
                isStreaming: false,
              };
            }
            return {
              messages: next,
              isStreaming: false,
              abortController: null,
            };
          });

          // Sync wallet credits
          if (data.creditsRemaining !== undefined) {
            useWalletStore.getState().setCreditsRemaining(data.creditsRemaining);
          }

          // Real-time Voice Conversation: Readout regenerated response if voice mode is on
          const finalRegenMsg = get().messages[get().messages.length - 1];
          if (get().isVoiceMode && finalRegenMsg && finalRegenMsg.content) {
            get().speakAiResponse(finalRegenMsg.content);
          }
        },
        onError: (err) => {
          if (err.name === 'AbortError') return;
          set((state) => {
            const next = [...state.messages];
            const idx = next.findIndex((m) => m._id === optimisticAssistantId);
            if (idx !== -1) {
              next[idx] = {
                ...next[idx],
                isStreaming: false,
                isThinking: false,
                error: true,
                errorMessage: err.message || 'Failed to generate response',
              };
            }
            return {
              messages: next,
              isStreaming: false,
              abortController: null,
              error: err.message,
            };
          });
        },
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      set((state) => {
        const next = [...state.messages];
        const idx = next.findIndex((m) => m._id === optimisticAssistantId);
        if (idx !== -1) {
          next[idx] = {
            ...next[idx],
            isStreaming: false,
            isThinking: false,
            error: true,
            errorMessage: err.message || 'Failed to generate response',
          };
        }
        return {
          messages: next,
          isStreaming: false,
          abortController: null,
          error: err.message,
        };
      });
    }
  },

  /**
   * Resend a prompt, regenerating the response in place
   * @param {string} content
   * @param {number} [targetIndex]
   */
  resendPrompt: async (content, targetIndex) => {
    return get().regenerateResponse(targetIndex);
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

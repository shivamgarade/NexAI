import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatStore } from './chatStore';
import { useAuthStore } from './authStore';
import { chatApi } from '@/lib/api/chat.api';
import { streamChatMessage } from '@/lib/sse';

vi.mock('@/lib/api/chat.api', () => ({
  chatApi: {
    getChats: vi.fn(),
    createChat: vi.fn(),
    updateChat: vi.fn(),
    deleteChat: vi.fn(),
    getMessages: vi.fn(),
  },
}));

vi.mock('@/lib/sse', () => ({
  streamChatMessage: vi.fn(),
  sanitizeErrorMessage: (msg) => msg || 'Error',
}));

describe('chatStore Zustand Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({
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
    });
    useAuthStore.setState({
      user: {
        _id: 'user-1',
        email: 'user@nexai.local',
        wallet: { creditsRemaining: 100 },
      },
      accessToken: 'test-token',
    });
  });

  it('fetches chats successfully', async () => {
    const mockChats = [
      { _id: 'chat-1', title: 'Conversation 1' },
      { _id: 'chat-2', title: 'Conversation 2' },
    ];
    chatApi.getChats.mockResolvedValueOnce({ data: mockChats });

    const result = await useChatStore.getState().fetchChats();

    expect(result).toEqual(mockChats);
    expect(useChatStore.getState().chats).toEqual(mockChats);
    expect(useChatStore.getState().isLoadingChats).toBe(false);
  });

  it('creates a new chat and sets activeChatId', async () => {
    const newChat = { _id: 'chat-3', title: 'Brand New Chat' };
    chatApi.createChat.mockResolvedValueOnce({ data: newChat });

    const result = await useChatStore.getState().createChat('Brand New Chat');

    expect(result).toEqual(newChat);
    expect(useChatStore.getState().chats).toContainEqual(newChat);
    expect(useChatStore.getState().activeChatId).toBe('chat-3');
    expect(useChatStore.getState().messages).toEqual([]);
  });

  it('selects a chat and fetches its messages', async () => {
    const mockMessages = [
      { _id: 'm1', role: 'user', content: 'Hello' },
      { _id: 'm2', role: 'assistant', content: 'Hi there!' },
    ];
    chatApi.getMessages.mockResolvedValueOnce({ data: mockMessages });

    await useChatStore.getState().selectChat('chat-1');

    expect(useChatStore.getState().activeChatId).toBe('chat-1');
    expect(chatApi.getMessages).toHaveBeenCalledWith('chat-1');
    expect(useChatStore.getState().messages).toEqual(mockMessages);
  });

  it('updates chat title', async () => {
    useChatStore.setState({
      chats: [{ _id: 'chat-1', title: 'Old Title' }],
    });

    const updated = { _id: 'chat-1', title: 'New Renamed Title' };
    chatApi.updateChat.mockResolvedValueOnce({ data: updated });

    await useChatStore.getState().updateChatTitle('chat-1', 'New Renamed Title');

    expect(chatApi.updateChat).toHaveBeenCalledWith('chat-1', 'New Renamed Title');
    expect(useChatStore.getState().chats[0].title).toBe('New Renamed Title');
  });

  it('deletes a chat and selects the next available chat', async () => {
    useChatStore.setState({
      chats: [
        { _id: 'chat-1', title: 'Chat 1' },
        { _id: 'chat-2', title: 'Chat 2' },
      ],
      activeChatId: 'chat-1',
    });
    chatApi.deleteChat.mockResolvedValueOnce({ data: { message: 'Deleted' } });
    chatApi.getMessages.mockResolvedValueOnce({ data: [] });

    await useChatStore.getState().deleteChat('chat-1');

    expect(chatApi.deleteChat).toHaveBeenCalledWith('chat-1');
    expect(useChatStore.getState().chats).toEqual([{ _id: 'chat-2', title: 'Chat 2' }]);
    expect(useChatStore.getState().activeChatId).toBe('chat-2');
  });

  it('deletes multiple chats and cleans up active selection', async () => {
    useChatStore.setState({
      chats: [
        { _id: 'chat-1', title: 'Chat 1' },
        { _id: 'chat-2', title: 'Chat 2' },
        { _id: 'chat-3', title: 'Chat 3' },
      ],
      activeChatId: 'chat-1',
    });
    chatApi.deleteChat.mockResolvedValue({ data: { message: 'Deleted' } });
    chatApi.getMessages.mockResolvedValueOnce({ data: [] });

    await useChatStore.getState().deleteMultipleChats(['chat-1', 'chat-2']);

    expect(chatApi.deleteChat).toHaveBeenCalledWith('chat-1');
    expect(chatApi.deleteChat).toHaveBeenCalledWith('chat-2');
    expect(useChatStore.getState().chats).toEqual([{ _id: 'chat-3', title: 'Chat 3' }]);
    expect(useChatStore.getState().activeChatId).toBe('chat-3');
  });

  it('sends a message, receives streaming tokens, and updates credits on done', async () => {
    useChatStore.setState({
      activeChatId: 'chat-1',
      chats: [{ _id: 'chat-1', title: 'New Chat' }],
      messages: [],
    });

    // Mock streamChatMessage to simulate onToken and onDone callbacks
    streamChatMessage.mockImplementation(async ({ onToken, onDone }) => {
      onToken('Hello ');
      onToken('world!');
      onDone({
        messageId: 'msg-final-1',
        tokensUsed: 42,
        creditsDeducted: 1,
        creditsRemaining: 99,
        chatTitle: 'Generated Chat Title',
      });
    });

    await useChatStore.getState().sendMessage('Hello AI');

    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0].role).toBe('user');
    expect(state.messages[0].content).toBe('Hello AI');
    expect(state.messages[1].role).toBe('assistant');
    expect(state.messages[1].content).toBe('Hello world!');
    expect(state.messages[1].tokensUsed).toBe(42);
    expect(state.isStreaming).toBe(false);

    // Verifies chatTitle updated
    expect(state.chats[0].title).toBe('Generated Chat Title');

    // Verifies authStore credit balance was updated reactively
    expect(useAuthStore.getState().user.wallet.creditsRemaining).toBe(99);
  });

  it('handles 402 insufficient credits error gracefully', async () => {
    useChatStore.setState({
      activeChatId: 'chat-1',
      chats: [{ _id: 'chat-1', title: 'Chat 1' }],
    });

    streamChatMessage.mockImplementation(async ({ onError }) => {
      const err = { status: 402, code: 'INSUFFICIENT_CREDITS', message: 'Recharge to continue' };
      onError(err);
      throw err;
    });

    await useChatStore.getState().sendMessage('Need response');

    const state = useChatStore.getState();
    expect(state.insufficientCredits).toBe(true);
    expect(state.isStreaming).toBe(false);
  });

  it('stops generation when stopGeneration is called', () => {
    const abortSpy = vi.fn();
    const mockController = { abort: abortSpy, signal: {} };

    useChatStore.setState({
      isStreaming: true,
      abortController: mockController,
      messages: [{ role: 'assistant', content: 'Partial text', isStreaming: true }],
    });

    useChatStore.getState().stopGeneration();

    expect(abortSpy).toHaveBeenCalled();
    expect(useChatStore.getState().isStreaming).toBe(false);
    expect(useChatStore.getState().abortController).toBeNull();
  });

  it('allows changing the selected model between flash and pro', () => {
    expect(useChatStore.getState().selectedModel).toBe('flash');
    useChatStore.getState().setSelectedModel('pro');
    expect(useChatStore.getState().selectedModel).toBe('pro');
  });

  it('regenerates assistant response in-place without duplicating the user message', async () => {
    const existingMessages = [
      { _id: 'u1', role: 'user', content: 'What is operating systems?' },
      { _id: 'a1', role: 'assistant', content: 'Old explanation...', error: false },
    ];

    useChatStore.setState({
      activeChatId: 'chat-1',
      messages: existingMessages,
    });

    streamChatMessage.mockImplementationOnce(async ({ onToken, onDone }) => {
      onToken('New regenerated response');
      onDone({ messageId: 'a1-new', tokensUsed: 15, creditsRemaining: 85 });
    });

    // Call regenerateResponse targeting assistant message at index 1
    await useChatStore.getState().regenerateResponse(1);

    const msgs = useChatStore.getState().messages;
    // Exactly 2 messages must remain: 1 user and 1 assistant
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toEqual(existingMessages[0]); // User message not duplicated
    expect(msgs[1].content).toBe('New regenerated response');
    expect(msgs[1]._id).toBe('a1-new');

    // Verify streamChatMessage was called with regenerate: true and the original user content
    expect(streamChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 'chat-1',
        content: 'What is operating systems?',
        regenerate: true,
      })
    );
  });

  it('does not set isThinking before thinking starts and updates isThinking lifecycle correctly', async () => {
    useChatStore.setState({
      activeChatId: 'chat-1',
      chats: [{ _id: 'chat-1', title: 'New Chat' }],
      messages: [],
      thinkingLevel: 'medium',
    });

    let capturedInitialAssistantState;

    streamChatMessage.mockImplementation(async ({ onThought, onToken, onDone }) => {
      // Capture assistant message state BEFORE any thought or token has streamed
      capturedInitialAssistantState = { ...useChatStore.getState().messages[1] };

      // Simulate model streaming thoughts
      onThought('Thinking about step 1... ');
      const stateWhileThinking = useChatStore.getState().messages[1];
      expect(stateWhileThinking.isThinking).toBe(true);
      expect(stateWhileThinking.thoughts).toBe('Thinking about step 1... ');

      // Simulate model beginning response content (thinking ends)
      onToken('Here is the answer.');
      const stateWhileStreamingContent = useChatStore.getState().messages[1];
      expect(stateWhileStreamingContent.isThinking).toBe(false);
      expect(stateWhileStreamingContent.content).toBe('Here is the answer.');

      onDone({
        messageId: 'msg-final-1',
        tokensUsed: 25,
        creditsDeducted: 1,
        creditsRemaining: 99,
      });
    });

    await useChatStore.getState().sendMessage('Explain quantum computing');

    // Verify initial assistant state had isThinking: false and empty thoughts
    expect(capturedInitialAssistantState.isThinking).toBe(false);
    expect(capturedInitialAssistantState.thoughts).toBe('');

    // Verify final state
    const finalAssistant = useChatStore.getState().messages[1];
    expect(finalAssistant.isThinking).toBe(false);
    expect(finalAssistant.isStreaming).toBe(false);
    expect(finalAssistant.thoughts).toBe('Thinking about step 1... ');
    expect(finalAssistant.content).toBe('Here is the answer.');
  });

  describe('Real-Time Voice Conversation Mode', () => {
    it('toggles voice conversation mode on and off', () => {
      expect(useChatStore.getState().isVoiceMode).toBe(false);

      useChatStore.getState().toggleVoiceMode();
      expect(useChatStore.getState().isVoiceMode).toBe(true);

      useChatStore.getState().toggleVoiceMode();
      expect(useChatStore.getState().isVoiceMode).toBe(false);
    });

    it('sets voice conversation mode explicitly', () => {
      useChatStore.getState().setVoiceMode(true);
      expect(useChatStore.getState().isVoiceMode).toBe(true);

      useChatStore.getState().setVoiceMode(false);
      expect(useChatStore.getState().isVoiceMode).toBe(false);
    });

    it('cancels speech and resets isAiSpeaking state', () => {
      useChatStore.setState({ isAiSpeaking: true });
      useChatStore.getState().cancelAiSpeech();
      expect(useChatStore.getState().isAiSpeaking).toBe(false);
    });
  });
});

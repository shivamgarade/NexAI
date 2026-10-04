import { create } from 'zustand';
import { interviewApi } from '@/lib/api/interview.api.js';
import { streamInterviewResponse, sanitizeErrorMessage } from '@/lib/sse.js';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/components/ui/Toast';

// Helper: sanitize markdown artifacts so TTS sounds natural and clear
function sanitizeForSpeech(raw) {
  if (!raw) return '';
  return raw
    .replace(/```[\s\S]*?```/g, ' Code snippet omitted. ') // Don't speak raw code blocks
    .replace(/`([^`]+)`/g, '$1') // Strip inline backticks
    .replace(/#{1,6}\s+/g, '') // Strip markdown heading markers
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // Strip bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // Strip italics
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Strip markdown links
    .replace(/^\s*[-*+]\s+/gm, '') // Strip bullet points
    .replace(/^\s*\d+\.\s+/gm, '') // Strip list numbers
    .replace(/^\s*>\s+/gm, '') // Strip blockquote markers
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper: pick the clearest natural voice available on the user's browser
function getBestSpeechVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. Prioritize Natural/Online Neural voices (Edge / Windows 11 / Chrome)
  const natural = voices.find(
    (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Online'))
  );
  if (natural) return natural;

  // 2. Google US English (Chrome)
  const google = voices.find((v) => v.name.includes('Google') && v.lang.startsWith('en'));
  if (google) return google;

  // 3. Clear US or GB English voices
  const standardEnglish = voices.find(
    (v) => v.lang === 'en-US' || v.lang === 'en-GB' || v.lang.startsWith('en')
  );
  if (standardEnglish) return standardEnglish;

  return voices[0] || null;
}

export const useInterviewStore = create((set, get) => ({
  // Past sessions history
  sessions: [],
  isLoadingSessions: false,

  // Setup form fields
  role: 'Full-Stack Engineer',
  difficulty: 'mid',
  topic: 'MERN Stack Architecture & REST/WebSocket APIs',
  selectedModel: 'flash',
  isSimulation: false,

  // Active session
  currentSession: null,
  messages: [],
  scorecard: null,
  archivedLibraryItem: null,

  // Loading & streaming indicators
  isStarting: false,
  isStreaming: false,
  isConcluding: false,
  abortController: null,
  error: null,
  insufficientCredits: false,

  // Audio & Speech states
  isListening: false,
  isSpeaking: false,
  speakingSource: null, // 'candidate' | 'interviewer' | null
  isTtsEnabled: true,
  transcriptOpen: false,

  // Setup action
  setSetupField: (field, value) => {
    set({ [field]: value });
  },

  toggleSimulation: () => {
    set((state) => ({ isSimulation: !state.isSimulation }));
  },

  setIsSimulation: (isSimulation) => {
    set({ isSimulation: Boolean(isSimulation) });
  },

  // Audio state actions
  setIsListening: (isListening) => {
    set((state) => ({
      isListening,
      isSpeaking: isListening ? true : state.speakingSource === 'interviewer' ? true : false,
      speakingSource: isListening ? 'candidate' : state.speakingSource === 'candidate' ? null : state.speakingSource,
    }));
  },

  setIsSpeaking: (isSpeaking, source = null) => {
    set({ isSpeaking, speakingSource: source });
  },

  toggleTts: () => {
    set((state) => {
      const next = !state.isTtsEnabled;
      if (!next && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return { isTtsEnabled: next };
    });
  },

  toggleTranscript: () => {
    set((state) => ({ transcriptOpen: !state.transcriptOpen }));
  },

  // Fetch list of past interviews
  fetchSessions: async () => {
    set({ isLoadingSessions: true });
    try {
      const res = await interviewApi.getInterviews();
      const payload = res?.data || res || {};
      const sessions = payload.interviews || res?.interviews || [];
      set({ sessions, isLoadingSessions: false });
    } catch {
      set({ isLoadingSessions: false });
    }
  },

  // Load an existing session
  loadSession: async (id) => {
    set({ isStarting: true, error: null });
    try {
      const res = await interviewApi.getInterviewById(id);
      const payload = res?.data || res || {};
      const session = payload.interview || res?.interview;
      if (!session) throw new Error('Session not found');

      set({
        currentSession: session,
        messages: session.messages || [],
        scorecard: session.scorecard || null,
        role: session.role,
        difficulty: session.difficulty,
        topic: session.topic,
        isStarting: false,
      });
    } catch (err) {
      set({ isStarting: false, error: err.message });
      toast.error('Failed to load interview session');
    }
  },

  // Start new interview with live Gemini AI or offline simulation
  startInterview: async (config = {}) => {
    const role = (config.role || get().role || 'Full-Stack Engineer').trim();
    const difficulty = config.difficulty || get().difficulty || 'mid';
    const topic = (config.topic || get().topic || 'MERN Stack Architecture & REST/WebSocket APIs').trim();
    const model = config.model || get().selectedModel || 'flash';
    const isSimulation =
      config.isSimulation !== undefined ? Boolean(config.isSimulation) : Boolean(get().isSimulation);

    set({
      isStarting: true,
      error: null,
      insufficientCredits: false,
      scorecard: null,
      archivedLibraryItem: null,
    });

    try {
      const res = await interviewApi.startInterview({
        role,
        difficulty,
        topic,
        model,
        isSimulation,
      });

      const payload = res?.data || res || {};
      const session = payload.session || res?.session;
      const creditsRemaining = payload.creditsRemaining ?? res?.creditsRemaining;

      if (!session) {
        throw new Error('No session returned from server');
      }

      if (typeof creditsRemaining === 'number') {
        useAuthStore.getState().updateCredits(creditsRemaining);
      }

      set({
        currentSession: session,
        messages: session.messages || [],
        isStarting: false,
      });

      // Speak initial interviewer greeting if TTS is enabled
      const firstMsg = session.messages?.[0]?.content;
      if (firstMsg && get().isTtsEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        get().speakInterviewerText(firstMsg);
      }

      toast.success('Interview started! Answer with voice or text.');
    } catch (err) {
      const is402 = err.response?.status === 402 || err.code === 'INSUFFICIENT_CREDITS';
      const cleanMessage = sanitizeErrorMessage(
        err.response?.data?.error?.message || err.message || 'Failed to start interview',
      );

      set({
        isStarting: false,
        error: cleanMessage,
      });

      toast.error(cleanMessage);
    }
  },

  // Send candidate answer and stream live Gemini interviewer response
  sendResponse: async (content) => {
    const trimmed = (content || '').trim();
    const session = get().currentSession;

    if (!trimmed || !session || get().isStreaming) return;

    const userMessage = {
      role: 'user',
      content: trimmed,
      tokensUsed: 0,
      timestamp: new Date().toISOString(),
    };

    const assistantPlaceholder = {
      role: 'assistant',
      content: '',
      tokensUsed: 0,
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };

    const abortController = new AbortController();

    set((state) => ({
      messages: [...state.messages, userMessage, assistantPlaceholder],
      isStreaming: true,
      abortController,
      error: null,
      isSpeaking: true,
      speakingSource: 'interviewer',
    }));

    try {
      const model = get().selectedModel;

      await streamInterviewResponse({
        interviewId: session._id,
        content: trimmed,
        model,
        isSimulation: Boolean(session.isSimulation || get().isSimulation),
        signal: abortController.signal,
        onToken: (text) => {
          set((state) => {
            const msgs = [...state.messages];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              msgs[msgs.length - 1] = {
                ...lastMsg,
                content: lastMsg.content + text,
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
                tokensUsed: doneData.tokensUsed || lastMsg.tokensUsed,
                isStreaming: false,
              };
            }
            return {
              messages: msgs,
              isStreaming: false,
              abortController: null,
              isSpeaking: false,
              speakingSource: null,
            };
          });

          // Sync credit balance reactively
          if (typeof doneData.creditsRemaining === 'number') {
            useAuthStore.getState().updateCredits(doneData.creditsRemaining);
          }

          // Trigger speech readout of completed response
          const msgs = get().messages;
          const completedText = msgs[msgs.length - 1]?.content;
          if (completedText && get().isTtsEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
            get().speakInterviewerText(completedText);
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
              error: cleanMessage,
              isSpeaking: false,
              speakingSource: null,
            };
          });

          if (err.name !== 'AbortError') {
            toast.error(cleanMessage);
          }
        },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        const cleanMessage = sanitizeErrorMessage(err.message || 'Failed to send response');

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
            error: cleanMessage,
            isSpeaking: false,
            speakingSource: null,
          };
        });

        toast.error(cleanMessage);
      }
    }
  },

  // Stop active generation
  stopStreaming: () => {
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
          isSpeaking: false,
          speakingSource: null,
        };
      });
    }
  },

  // Conclude session, generate AI evaluation scorecard, and auto-archive
  concludeInterview: async () => {
    const session = get().currentSession;
    if (!session) return;

    // Cancel active TTS if playing
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    set({ isConcluding: true, error: null });

    try {
      const model = get().selectedModel;
      const isSimulation = Boolean(session.isSimulation || get().isSimulation);
      const res = await interviewApi.concludeInterview(session._id, {
        model,
        isSimulation,
      });
      const payload = res?.data || res || {};
      const updatedSession = payload.session || res?.session;
      const libraryItem = payload.libraryItem || res?.libraryItem;
      const creditsRemaining = payload.creditsRemaining ?? res?.creditsRemaining;

      if (!updatedSession) {
        throw new Error('No updated session data received');
      }

      if (typeof creditsRemaining === 'number') {
        useAuthStore.getState().updateCredits(creditsRemaining);
      }

      set({
        currentSession: updatedSession,
        scorecard: updatedSession.scorecard,
        archivedLibraryItem: libraryItem,
        isConcluding: false,
      });

      toast.success('Interview concluded! Scorecard generated & saved to Library.');
      get().fetchSessions().catch(() => {});
    } catch (err) {
      const is402 = err.response?.status === 402 || err.code === 'INSUFFICIENT_CREDITS';
      const cleanMessage = sanitizeErrorMessage(
        err.response?.data?.error?.message || err.message || 'Failed to conclude interview',
      );

      set({
        isConcluding: false,
        error: cleanMessage,
      });

      toast.error(cleanMessage);
    }
  },

  // Text-To-Speech audio readout helper with markdown sanitization and natural voice selection
  speakInterviewerText: (text) => {
    if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel();

      const spokenText = sanitizeForSpeech(text);
      if (!spokenText) return;

      const utterance = new SpeechSynthesisUtterance(spokenText);
      const voice = getBestSpeechVoice();
      if (voice) {
        utterance.voice = voice;
      }
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        set({ isSpeaking: true, speakingSource: 'interviewer' });
      };

      utterance.onend = () => {
        set((state) => ({
          isSpeaking: state.isListening ? true : false,
          speakingSource: state.isListening ? 'candidate' : null,
        }));
      };

      utterance.onerror = () => {
        set((state) => ({
          isSpeaking: state.isListening ? true : false,
          speakingSource: state.isListening ? 'candidate' : null,
        }));
      };

      // Keep reference to prevent garbage collection cutting off long speech turns
      window.__nexaiSpeechUtterance = utterance;

      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech synthesis unsupported or failed silently
    }
  },

  // Reset to setup screen
  resetSession: () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    set({
      currentSession: null,
      messages: [],
      scorecard: null,
      archivedLibraryItem: null,
      error: null,
      isStreaming: false,
      isStarting: false,
      isConcluding: false,
    });
  },
}));

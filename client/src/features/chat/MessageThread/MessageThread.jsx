import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { ROUTES } from '@/constants/routes';
import {
  Sparkles,
  ArrowDown,
  ArrowRight,
  Square,
  Copy,
  Check,
  RotateCcw,
  Edit3,
  AlertCircle,
  BookmarkPlus,
  BookOpen,
  Brain,
  Volume2,
  VolumeX,
  Loader2,
  HelpCircle,
  Code2,
  Mail,
  Server,
  MessageSquareDashed,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ThinkingIndicator } from '@/components/ui/ThinkingIndicator';
import { Tooltip } from '@/components/ui/Tooltip';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ThinkingDrawer } from '../ThinkingDrawer/ThinkingDrawer';
import { InlineThinking } from './InlineThinking';
import { MessageAttachments } from './MessageAttachments';
import { AgentStepTimeline } from './AgentStepTimeline';
import { PromptFormModal } from '@/features/prompts';
import { interviewApi } from '@/lib/api/interview.api.js';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { usePromptStore } from '@/store/promptStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useMemoryStore } from '@/store/memoryStore';
import { toast } from '@/store/uiStore';

import { cn } from '@/lib/utils/cn';
import logoImg from '@/assets/logo.png';
import styles from './MessageThread.module.scss';

const PROMPT_SUGGESTIONS = [
  {
    icon: HelpCircle,
    title: 'Explain a Concept',
    description: 'Explain quantum computing in simple, intuitive terms.',
  },
  {
    icon: Code2,
    title: 'Code Assistance',
    description: 'Write a Python script to parse and transform a CSV dataset.',
  },
  {
    icon: Mail,
    title: 'Professional Writing',
    description: 'Draft a polite follow-up email after a job interview.',
  },
  {
    icon: Server,
    title: 'System Architecture',
    description: 'Design a scalable caching strategy for an API using Redis.',
  },
];

function formatTime(timestamp) {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

let globalAudioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
      globalAudioCtx = new AudioCtx();
    }
    return globalAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Strips auto-generated placeholder prefixes and legacy context blocks from display prompt
 */
function getDisplayPrompt(content, attachments) {
  if (!content || typeof content !== 'string') return '';
  const hasAtt = Array.isArray(attachments) && attachments.length > 0;
  // If content is just an auto-generated placeholder when user submitted without typing prompt
  const isAutoPlaceholder = /^\[(Analyzed|Attached)\s+[^\]]+\]$/i.test(content.trim());
  if (isAutoPlaceholder && hasAtt) {
    return '';
  }
  // If content has legacy "[Attached Context: ...]\n...[End of Context]\n\n<user prompt>"
  const contextBlockMatch = content.match(/^\[Attached Context:[^\]]+\][\s\S]*?\[End of Context\]\s*/i);
  if (contextBlockMatch) {
    const afterContext = content.slice(contextBlockMatch[0].length).trim();
    if (afterContext) return afterContext;
    if (hasAtt) return '';
  }
  return content;
}

/**
 * Prepares raw markdown or message text for clear speech synthesis.
 */
function prepareTextForSpeech(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  return rawText
    // Remove fenced code blocks
    .replace(/```[\s\S]*?```/g, 'Code block omitted.')
    // Remove LaTeX math blocks and expressions
    .replace(/\$\$[\s\S]*?\$\$/g, '')
    .replace(/\$[^$]+\$/g, '')
    // Remove Markdown tables
    .replace(/^\|.*?\|$/gm, '')
    // Remove images
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Remove links keeping link text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove GitHub alert blocks (> [!TIP], etc.)
    .replace(/>\s*\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/gi, '')
    // Remove blockquote and heading markers
    .replace(/^[>#]+\s*/gm, '')
    // Inline code backticks
    .replace(/`([^`]+)`/g, '$1')
    // Horizontal rules and divider lines
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // List bullet / numerical prefixes
    .replace(/^[\s*+-]+(?=\S)/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Text formatting markers
    .replace(/[*_~]+/g, '')
    // Normalize extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Robust audio player for binary blobs:
 * 1. Primary: Web Audio API (uncompressed PCM audio pipeline directly to hardware output).
 * 2. Fallback: HTMLAudioElement with blob URL.
 */
async function playAudioBlob(blob, { onStart, onEnded, onError } = {}) {
  const ctx = getAudioContext();
  if (ctx) {
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await new Promise((resolve, reject) => {
        ctx.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
      });

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      let ended = false;
      const handleEnded = () => {
        if (!ended) {
          ended = true;
          onEnded?.();
        }
      };

      source.onended = handleEnded;
      source.start(0);
      onStart?.();

      return {
        stop: () => {
          if (!ended) {
            ended = true;
            try {
              source.stop(0);
              source.disconnect();
            } catch {
              // ignore
            }
            onEnded?.();
          }
        },
      };
    } catch (e) {
      console.warn('Web Audio API playback failed, trying HTMLAudio fallback:', e);
    }
  }

  // HTMLAudioElement fallback
  const audioUrl = URL.createObjectURL(blob);
  const audio = new Audio(audioUrl);
  audio.volume = 1.0;
  audio.preload = 'auto';

  let ended = false;
  const cleanup = () => {
    if (!ended) {
      ended = true;
      try {
        audio.pause();
        audio.src = '';
      } catch {
        // ignore
      }
      URL.revokeObjectURL(audioUrl);
      onEnded?.();
    }
  };

  audio.onplay = () => {
    onStart?.();
  };
  audio.onended = cleanup;
  audio.onerror = (err) => {
    cleanup();
    onError?.(err);
  };

  try {
    await audio.play();
    return {
      stop: () => {
        cleanup();
      },
    };
  } catch (err) {
    cleanup();
    onError?.(err);
    throw err;
  }
}

/**
 * Truncates text up to maxChars at natural sentence/word boundary
 */
function truncateToBoundary(text, maxChars = 2500) {
  if (!text || text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  const lastPunctuation = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('। '),
    truncated.lastIndexOf('\n')
  );
  if (lastPunctuation > maxChars * 0.7) {
    return truncated.slice(0, lastPunctuation + 1).trim();
  }
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.7) {
    return truncated.slice(0, lastSpace).trim() + '...';
  }
  return truncated;
}

/**
 * Selects the highest quality natural/language-appropriate voice for Web Speech API
 */
function getBestSpeechVoice(text = '') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const hasDevanagari = /[\u0900-\u097F]/.test(text || '');
  if (hasDevanagari) {
    const hindiVoice = voices.find(
      (v) => v.lang.startsWith('hi') || v.lang.includes('IN')
    );
    if (hindiVoice) return hindiVoice;
  }

  // 1. Natural / Online Neural voices (Windows 11 / Edge / Chrome)
  const natural = voices.find(
    (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Online'))
  );
  if (natural) return natural;

  // 2. Google US / UK English (Chrome)
  const google = voices.find((v) => v.name.includes('Google') && v.lang.startsWith('en'));
  if (google) return google;

  // 3. Clear US or GB English voices
  const standardEnglish = voices.find(
    (v) => v.lang === 'en-US' || v.lang === 'en-GB' || v.lang.startsWith('en')
  );
  if (standardEnglish) return standardEnglish;

  return voices[0] || null;
}

/**
 * Fallback Web Speech API player
 */
function playBrowserSpeech(text, { onStart, onEnded, onError } = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onError?.(new Error('Speech synthesis not supported in this browser'));
    return null;
  }

  try {
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getBestSpeechVoice(text);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      const hasDevanagari = /[\u0900-\u097F]/.test(text || '');
      utterance.lang = hasDevanagari ? 'hi-IN' : 'en-US';
    }
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    let ended = false;
    const handleEnd = () => {
      if (!ended) {
        ended = true;
        onEnded?.();
      }
    };

    utterance.onstart = () => {
      onStart?.();
    };
    utterance.onend = handleEnd;
    utterance.onerror = (e) => {
      if (e.error === 'canceled' || e.error === 'interrupted') {
        handleEnd();
        return;
      }
      if (!ended) {
        ended = true;
        onError?.(e);
      }
    };

    window.speechSynthesis.speak(utterance);

    return {
      stop: () => {
        if (!ended) {
          ended = true;
          try {
            window.speechSynthesis.cancel();
          } catch {
            // ignore
          }
          onEnded?.();
        }
      },
    };
  } catch (err) {
    onError?.(err);
    return null;
  }
}

export function MessageThread({ onSelectSuggestion, onEditPrompt }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const {
    messages,
    isLoadingMessages,
    isStreaming,
    stopGeneration,
    resendPrompt,
    selectChat,
    setActiveDrawerThought,
  } = useChatStore();
  const createPrompt = usePromptStore((state) => state.createPrompt);

  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);
  const [loadingTtsId, setLoadingTtsId] = useState(null);
  const [savePromptData, setSavePromptData] = useState(null);
  const userScrolledUpRef = useRef(false);
  const activePlaybackRef = useRef(null);
  const ttsAbortRef = useRef(null);

  // Stop any active speech on unmount
  useEffect(() => {
    return () => {
      ttsAbortRef.current?.abort();
      if (activePlaybackRef.current) {
        try {
          activePlaybackRef.current.stop();
        } catch {
          // ignore
        }
        activePlaybackRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleToggleSpeak = async (text, id) => {
    // If clicking on active speaking or currently loading message, stop immediately
    if (speakingId === id || loadingTtsId === id) {
      ttsAbortRef.current?.abort();
      if (activePlaybackRef.current) {
        try {
          activePlaybackRef.current.stop();
        } catch {
          // ignore
        }
        activePlaybackRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setSpeakingId(null);
      setLoadingTtsId(null);
      return;
    }

    // Cancel any current audio/speech/loading before starting new
    ttsAbortRef.current?.abort();
    if (activePlaybackRef.current) {
      try {
        activePlaybackRef.current.stop();
      } catch {
        // ignore
      }
      activePlaybackRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
    setLoadingTtsId(null);

    const cleanText = prepareTextForSpeech(text);
    if (!cleanText) {
      toast.info('No readable text to read aloud');
      return;
    }

    // Unlock/resume AudioContext immediately in user interaction gesture
    const audioCtx = getAudioContext();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const abortController = new AbortController();
    ttsAbortRef.current = abortController;
    setLoadingTtsId(id);

    const textToSynthesize = truncateToBoundary(cleanText, 2500);
    const hasHindi = /[\u0900-\u097F]/.test(textToSynthesize);
    const selectedVoice = hasHindi ? 'hi-IN-MadhurNeural' : 'en-US-ChristopherNeural';

    const fallbackToBrowserSpeech = () => {
      if (abortController.signal.aborted) return;
      const browserPlayback = playBrowserSpeech(textToSynthesize, {
        onStart: () => {
          setLoadingTtsId(null);
          setSpeakingId(id);
        },
        onEnded: () => {
          setSpeakingId(null);
          setLoadingTtsId(null);
          activePlaybackRef.current = null;
        },
        onError: (speechErr) => {
          console.warn('Browser speech synthesis fallback error:', speechErr);
          setSpeakingId(null);
          setLoadingTtsId(null);
          activePlaybackRef.current = null;
          toast.error('Unable to play audio speech');
        },
      });

      if (browserPlayback) {
        activePlaybackRef.current = browserPlayback;
      } else {
        setSpeakingId(null);
        setLoadingTtsId(null);
        activePlaybackRef.current = null;
        toast.error('Unable to play audio speech');
      }
    };

    try {
      // 1. High-fidelity Microsoft Edge Neural TTS (~400ms ultra-low latency, studio grade 24kHz)
      const res = await interviewApi.synthesizeSpeech({
        text: textToSynthesize,
        engine: 'edge',
        voice: selectedVoice,
      });

      if (abortController.signal.aborted) return;

      const rawData = res?.data ?? res;
      const audioBlob =
        rawData instanceof Blob
          ? rawData.type
            ? rawData
            : new Blob([rawData], { type: 'audio/mpeg' })
          : new Blob([rawData], { type: 'audio/mpeg' });

      if (!audioBlob || (audioBlob.size !== undefined && audioBlob.size === 0)) {
        throw new Error('Empty audio stream received');
      }

      if (audioBlob.type?.includes('application/json')) {
        const textErr = await audioBlob.text();
        throw new Error(`TTS service error: ${textErr}`);
      }

      const playback = await playAudioBlob(audioBlob, {
        onStart: () => {
          setLoadingTtsId(null);
          setSpeakingId(id);
        },
        onEnded: () => {
          setSpeakingId(null);
          setLoadingTtsId(null);
          activePlaybackRef.current = null;
        },
        onError: (err) => {
          console.warn('Audio playback error, falling back to Web Speech API:', err);
          fallbackToBrowserSpeech();
        },
      });

      activePlaybackRef.current = playback;
    } catch (err) {
      if (abortController.signal.aborted) return;
      console.warn('Edge Neural TTS error, falling back to Web Speech API:', err);
      fallbackToBrowserSpeech();
    }
  };

  const handleCopy = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleResendUserPrompt = (content) => {
    if (isStreaming) return;
    resendPrompt(content);
  };

  const handleRetryAssistant = (index) => {
    if (isStreaming) return;
    // Find closest preceding user message
    const precedingUserMsg = messages
      .slice(0, index)
      .reverse()
      .find((m) => m.role === 'user');

    if (precedingUserMsg?.content) {
      resendPrompt(precedingUserMsg.content);
    }
  };

  const handleUndoMemory = async (memoryId, msgIndex) => {
    try {
      if (memoryId) {
        await useMemoryStore.getState().deleteMemory(memoryId);
      }
      useChatStore.setState((state) => {
        const msgs = [...state.messages];
        if (msgs[msgIndex]) {
          msgs[msgIndex] = {
            ...msgs[msgIndex],
            memoriesUpdated: [],
          };
        }
        return { messages: msgs };
      });
      toast.success('Memory undone and removed from profile');
    } catch {
      toast.error('Failed to undo memory');
    }
  };

  // Check scroll position to determine if auto-scroll should happen
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
    userScrolledUpRef.current = !isNearBottom;
    setShowScrollBottom((prev) => (prev !== !isNearBottom ? !isNearBottom : prev));
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end',
      });
    }
  }, []);

  // Auto-scroll when messages update, unless user scrolled up
  useEffect(() => {
    if (!userScrolledUpRef.current) {
      scrollToBottom(false);
    }
  }, [messages, scrollToBottom]);

  // When a new stream begins, scroll to bottom
  useEffect(() => {
    if (isStreaming) {
      userScrolledUpRef.current = false;
      scrollToBottom(true);
    }
  }, [isStreaming, scrollToBottom]);

  return (
    <div className={styles.threadContainer}>
      <div
        ref={containerRef}
        className={styles.scrollArea}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Message history"
      >
        {isLoadingMessages && messages.length === 0 ? (
          <div className={styles.loadingList}>
            <div className={styles.skeletonMessageUser}>
              <Skeleton width="50%" height="56px" radius="lg" />
            </div>
            <div className={styles.skeletonMessageAi}>
              <Skeleton width="75%" height="110px" radius="lg" />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className={styles.emptyThreadNotice}>
            <EmptyState
              icon={<MessageSquareDashed size={36} />}
              title="No messages yet"
              description="Start the conversation by typing a prompt below."
            />
          </div>
        ) : (
          <div className={styles.messageList}>
            {messages.map((message, index) => {
              const isUser = message.role === 'user';
              const isLast = index === messages.length - 1;
              const isCurrentlyStreaming = isLast && isStreaming && !isUser;
              const hasError = Boolean(message.error);
              const messageId = message._id || `msg-${index}`;
              const isCopied = copiedId === messageId;
              const timeString = formatTime(message.createdAt);
              const hasAttachments = Array.isArray(message.attachments) && message.attachments.length > 0;
              const displayContent = isUser
                ? getDisplayPrompt(message.content, message.attachments)
                : message.content;

              return (
                <div
                  key={messageId}
                  className={cn(styles.messageRow, isUser ? styles.userRow : styles.assistantRow)}
                >
                  <div className={styles.avatarWrapper}>
                    {isUser ? (
                      <Avatar name={user?.email || 'User'} size="sm" />
                    ) : isCurrentlyStreaming && !message.content ? (
                      <ThinkingIndicator variant="dots" size="sm" />
                    ) : (
                      <div className={styles.aiAvatar}>
                        <img src={logoImg} alt="NexAI" className={styles.avatarLogo} />
                      </div>
                    )}
                  </div>

                  <div className={styles.messageContentWrapper}>
                    <div className={styles.metaHeader}>
                      <span className={styles.senderName}>{isUser ? 'You' : 'NexAI'}</span>
                      {timeString && <span className={styles.timestamp}>{timeString}</span>}
                      {message.tokensUsed ? (
                        <Badge tone="neutral" className={styles.tokenBadge}>
                          ⚡ {message.tokensUsed} tokens
                        </Badge>
                      ) : null}
                    </div>

                    <div
                      className={cn(
                        styles.bubble,
                        isUser ? styles.userBubble : styles.assistantBubble,
                        hasError && styles.errorBubble,
                      )}
                    >
                      {isUser ? (
                        <div className={styles.userContentContainer}>
                          {hasAttachments && (
                            <MessageAttachments attachments={message.attachments} />
                          )}
                          {displayContent ? (
                            <div className={styles.userText}>{displayContent}</div>
                          ) : null}
                        </div>
                      ) : (
                        <div className={styles.aiContentContainer}>
                          {hasAttachments && (
                            <MessageAttachments attachments={message.attachments} />
                          )}
                          {Boolean(message.contextSource || message.groundedSource) && (
                            <div className={styles.groundedSourceBadge} title="Grounded with verified knowledge from Knowledge Vault">
                              <BookOpen size={12} className={styles.groundedSourceIcon} />
                              <span>Grounded with: {message.contextSource || message.groundedSource}</span>
                            </div>
                          )}
                          <AgentStepTimeline
                            steps={message.steps}
                            groundingMetadata={message.groundingMetadata}
                            isStreaming={isCurrentlyStreaming}
                          />
                          {Boolean(message.thoughts || (isCurrentlyStreaming && message.isThinking)) && (
                            <InlineThinking
                              thoughts={message.thoughts}
                              isThinking={Boolean(message.isThinking || (isCurrentlyStreaming && !message.content))}
                              isStreaming={isCurrentlyStreaming}
                            />
                          )}

                          {isCurrentlyStreaming && !message.content && !message.thoughts ? (
                            <div className={styles.aiMarkdown}>
                              <span className={styles.blinkingCursor} aria-hidden="true" />
                            </div>
                          ) : hasError ? (
                            <div className={styles.errorCard}>
                              <div className={styles.errorContent}>
                                <AlertCircle size={16} className={styles.errorIcon} />
                                <span>{message.error}</span>
                              </div>
                              <Button
                                variant="secondary"
                                size="sm"
                                leftIcon={<RotateCcw size={13} />}
                                onClick={() => handleRetryAssistant(index)}
                                disabled={isStreaming}
                                className={styles.retryButton}
                              >
                                Retry
                              </Button>
                            </div>
                          ) : (
                            <div className={styles.aiMarkdown}>
                              <MarkdownRenderer
                                content={message.content}
                                isStreaming={isCurrentlyStreaming}
                                onSavePrompt={(promptData) => setSavePromptData(promptData)}
                                onUsePrompt={(template) => {
                                  selectChat(null);
                                  navigate(ROUTES.CHAT, { state: { prefill: template } });
                                }}
                              />
                              {isCurrentlyStreaming && (
                                <span className={styles.blinkingCursor} aria-hidden="true" />
                              )}
                            </div>
                          )}

                          {Array.isArray(message.memoriesUpdated) && message.memoriesUpdated.length > 0 && (
                            <div className={styles.memoryUpdatedBanner}>
                              <Sparkles size={13} className={styles.memoryUpdatedIcon} />
                              <span className={styles.memoryUpdatedText}>
                                Memory updated: <em>{message.memoriesUpdated[0].fact}</em>
                              </span>
                              <button
                                type="button"
                                className={styles.memoryUndoBtn}
                                onClick={() => handleUndoMemory(message.memoriesUpdated[0].id, index)}
                                title="Undo this saved memory"
                              >
                                Undo
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Bar on hover */}
                    {!isCurrentlyStreaming && (
                      <div className={styles.actionToolbar}>
                        {isUser ? (
                          <>
                            <Tooltip content={isCopied ? 'Copied!' : 'Copy prompt'} side="top">
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => handleCopy(displayContent || message.content, messageId)}
                                aria-label="Copy prompt"
                              >
                                {isCopied ? (
                                  <Check size={15} className={styles.copiedIcon} />
                                ) : (
                                  <Copy size={15} />
                                )}
                              </button>
                            </Tooltip>
                            <Tooltip content="Edit prompt" side="top">
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => onEditPrompt?.(displayContent || message.content)}
                                aria-label="Edit prompt"
                              >
                                <Edit3 size={15} />
                              </button>
                            </Tooltip>
                            <Tooltip content="Resend prompt" side="top">
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => handleResendUserPrompt(displayContent || message.content)}
                                aria-label="Resend prompt"
                                disabled={isStreaming}
                              >
                                <RotateCcw size={15} />
                              </button>
                            </Tooltip>
                            <Tooltip content="Save to Prompt Vault" side="top">
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() =>
                                  setSavePromptData({
                                    title: 'Saved User Prompt',
                                    template: displayContent || message.content,
                                  })
                                }
                                aria-label="Save to Prompt Vault"
                              >
                                <BookmarkPlus size={15} />
                              </button>
                            </Tooltip>
                            <Tooltip content="Save to Library" side="top">
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => {
                                  const textToSave = displayContent || message.content;
                                  const titleHint =
                                    textToSave
                                      .split('\n')[0]
                                      .replace(/^[#*-]+\s*/, '')
                                      .slice(0, 45) || 'User Note';
                                  useLibraryStore.getState().openAddModal({
                                    type: 'note',
                                    title: titleHint,
                                    content: textToSave,
                                    tags: ['chat', 'note'],
                                  });
                                }}
                                aria-label="Save to Library"
                              >
                                <BookOpen size={15} />
                              </button>
                            </Tooltip>
                          </>
                        ) : (
                          <>
                            <Tooltip content={isCopied ? 'Copied!' : 'Copy response'} side="top">
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => handleCopy(message.content, messageId)}
                                aria-label="Copy response"
                              >
                                {isCopied ? (
                                  <Check size={15} className={styles.copiedIcon} />
                                ) : (
                                  <Copy size={15} />
                                )}
                              </button>
                            </Tooltip>
                            <Tooltip content="Regenerate response" side="top">
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => handleRetryAssistant(index)}
                                aria-label="Regenerate response"
                                disabled={isStreaming}
                              >
                                <RotateCcw size={15} />
                              </button>
                            </Tooltip>
                            <Tooltip content="Save to Prompt Vault" side="top">
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() =>
                                  setSavePromptData({
                                    title: 'Saved AI Response',
                                    template: message.content,
                                  })
                                }
                                aria-label="Save to Prompt Vault"
                              >
                                <BookmarkPlus size={15} />
                              </button>
                            </Tooltip>
                            <Tooltip content="Save to Library" side="top">
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={() => {
                                  const titleHint =
                                    message.content
                                      .split('\n')[0]
                                      .replace(/^[#*-]+\s*/, '')
                                      .slice(0, 45) || 'AI Solution Note';
                                  useLibraryStore.getState().openAddModal({
                                    type: 'note',
                                    title: titleHint,
                                    content: message.content,
                                    tags: ['chat', 'ai-solution'],
                                  });
                                }}
                                aria-label="Save to Library"
                              >
                                <BookOpen size={15} />
                              </button>
                            </Tooltip>
                            {Boolean(message.thoughts) && (
                              <Tooltip content="Show AI Thinking & Reasoning" side="top">
                                <button
                                  type="button"
                                  className={cn(styles.actionBtn, styles.thinkingActionBtn)}
                                  onClick={() =>
                                    setActiveDrawerThought(message.thoughts || message._id)
                                  }
                                  aria-label="Show AI Thinking & Reasoning"
                                >
                                  <Brain size={15} className={styles.brainIcon} />
                                </button>
                              </Tooltip>
                            )}
                            <Tooltip
                              content={
                                loadingTtsId === messageId
                                  ? 'Generating audio...'
                                  : speakingId === messageId
                                    ? 'Stop reading aloud'
                                    : 'Read aloud'
                              }
                              side="top"
                            >
                              <button
                                type="button"
                                className={cn(
                                  styles.actionBtn,
                                  speakingId === messageId && styles.speakingBtn,
                                  loadingTtsId === messageId && styles.loadingBtn,
                                )}
                                onClick={() => handleToggleSpeak(message.content, messageId)}
                                aria-label={
                                  loadingTtsId === messageId
                                    ? 'Generating audio'
                                    : speakingId === messageId
                                      ? 'Stop reading aloud'
                                      : 'Read aloud'
                                }
                              >
                                {loadingTtsId === messageId ? (
                                  <Loader2 size={15} className={styles.spinIcon} />
                                ) : speakingId === messageId ? (
                                  <VolumeX size={15} />
                                ) : (
                                  <Volume2 size={15} />
                                )}
                              </button>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    )}

                    {/* Suggested follow-up prompt chips */}
                    {!isCurrentlyStreaming && isLast && !isUser && message.followUps && message.followUps.length > 0 && (
                      <div className={styles.followUpsRow}>
                        <div className={styles.followUpsLabel}>
                          <Sparkles size={13} className={styles.followUpSparkle} />
                          <span>Suggested next steps:</span>
                        </div>
                        <div className={styles.followUpsList}>
                          {message.followUps.map((chip, chipIdx) => (
                            <button
                              key={chipIdx}
                              type="button"
                              className={styles.followUpChip}
                              onClick={() => onSelectSuggestion?.(chip)}
                              title={`Ask: "${chip}"`}
                            >
                              <span>{chip}</span>
                              <ArrowRight size={12} className={styles.chipArrow} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} className={styles.scrollAnchor} />
          </div>
        )}
      </div>

      {/* Floating control buttons */}
      <div className={styles.floatingControls}>
        {isStreaming && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Square size={14} fill="currentColor" />}
            onClick={stopGeneration}
            className={styles.stopButton}
          >
            Stop generating
          </Button>
        )}

        {showScrollBottom && (
          <button
            type="button"
            className={styles.scrollDownButton}
            onClick={() => scrollToBottom(true)}
            aria-label="Scroll to bottom"
          >
            <ArrowDown size={16} />
          </button>
        )}
      </div>

      {/* Save to Prompt Vault Modal */}
      <PromptFormModal
        open={Boolean(savePromptData)}
        onClose={() => setSavePromptData(null)}
        initialData={savePromptData}
        onSubmit={async (data) => {
          await createPrompt(data);
        }}
      />

      {/* AI Reasoning / Thinking Slide-Over Drawer */}
      <ThinkingDrawer />
    </div>

  );
}

MessageThread.propTypes = {
  onSelectSuggestion: PropTypes.func,
  onEditPrompt: PropTypes.func,
};

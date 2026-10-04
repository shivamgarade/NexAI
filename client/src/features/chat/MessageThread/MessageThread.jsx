import { useRef, useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
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
  HelpCircle,
  Code2,
  Mail,
  Server,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ThinkingDrawer } from '../ThinkingDrawer/ThinkingDrawer';
import { PromptFormModal } from '@/features/prompts';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { usePromptStore } from '@/store/promptStore';
import { useLibraryStore } from '@/store/libraryStore';
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
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function MessageThread({ onSelectSuggestion, onEditPrompt }) {
  const user = useAuthStore((state) => state.user);
  const {
    messages,
    isLoadingMessages,
    isStreaming,
    stopGeneration,
    resendPrompt,
    setActiveDrawerThought,
  } = useChatStore();
  const createPrompt = usePromptStore((state) => state.createPrompt);

  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);
  const [savePromptData, setSavePromptData] = useState(null);
  const userScrolledUpRef = useRef(false);

  // Stop any active speech on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleToggleSpeak = (text, id) => {
    if (!('speechSynthesis' in window)) {
      toast.error('Text-to-speech is not supported in this browser');
      return;
    }

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = (text || '')
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[#*_~>]/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setSpeakingId(null);
    };

    utterance.onerror = () => {
      setSpeakingId(null);
    };

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
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

  // Check scroll position to determine if auto-scroll should happen
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
    userScrolledUpRef.current = !isNearBottom;
    setShowScrollBottom(!isNearBottom);
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
          <div className={styles.emptyWelcome}>
            <div className={styles.welcomeLogoWrapper}>
              <img src={logoImg} alt="NexAI" className={styles.welcomeLogo} />
            </div>
            <h2 className={styles.welcomeTitle}>How can NexAI assist you today?</h2>
            <p className={styles.welcomeSubtitle}>
              Ask anything, brainstorm code, solve system architecture, or pick a starter below.
            </p>

            <div className={styles.suggestionsGrid}>
              {PROMPT_SUGGESTIONS.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    className={styles.suggestionCard}
                    onClick={() => onSelectSuggestion?.(item.description)}
                  >
                    <div className={styles.suggestionHeader}>
                      <span className={styles.suggestionIconWrapper}>
                        <IconComponent size={16} />
                      </span>
                      <span className={styles.suggestionTitle}>{item.title}</span>
                    </div>
                    <span className={styles.suggestionDesc}>{item.description}</span>
                  </button>
                );
              })}
            </div>
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

              return (
                <div
                  key={messageId}
                  className={cn(styles.messageRow, isUser ? styles.userRow : styles.assistantRow)}
                >
                  <div className={styles.avatarWrapper}>
                    {isUser ? (
                      <Avatar name={user?.email || 'User'} size="sm" />
                    ) : (
                      <div
                        className={cn(
                          styles.aiAvatar,
                          isCurrentlyStreaming && !message.content && styles.aiAvatarThinking,
                        )}
                      >
                        {isCurrentlyStreaming && !message.content ? (
                          <div className={styles.geminiSpinner} aria-label="Thinking...">
                            <span className={styles.geminiDot} />
                            <span className={styles.geminiDot} />
                            <span className={styles.geminiDot} />
                          </div>
                        ) : (
                          <img src={logoImg} alt="NexAI" className={styles.avatarLogo} />
                        )}
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
                        <div className={styles.userText}>{message.content}</div>
                      ) : isCurrentlyStreaming && !message.content ? (
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
                          {isCurrentlyStreaming && (message.isThinking || message.thoughts) && (
                            <div
                              className={styles.liveThinkingIndicator}
                              onClick={() =>
                                setActiveDrawerThought(message.thoughts || message._id)
                              }
                              title="Click to view AI reasoning steps in drawer"
                              role="button"
                              tabIndex={0}
                            >
                              <Brain size={14} className={styles.pulsingBrain} />
                              <span>Thinking & reasoning...</span>
                            </div>
                          )}
                          <MarkdownRenderer
                            content={message.content}
                            isStreaming={isCurrentlyStreaming}
                          />
                          {isCurrentlyStreaming && (
                            <span className={styles.blinkingCursor} aria-hidden="true" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Bar on hover */}
                    {!isCurrentlyStreaming && (
                      <div className={styles.actionToolbar}>
                        {isUser ? (
                          <>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => handleCopy(message.content, messageId)}
                              title="Copy prompt"
                              aria-label="Copy prompt"
                            >
                              {isCopied ? (
                                <Check size={13} className={styles.copiedIcon} />
                              ) : (
                                <Copy size={13} />
                              )}
                              <span>{isCopied ? 'Copied' : 'Copy'}</span>
                            </button>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => onEditPrompt?.(message.content)}
                              title="Edit prompt in input box"
                              aria-label="Edit prompt in input box"
                            >
                              <Edit3 size={13} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => handleResendUserPrompt(message.content)}
                              title="Resend this prompt"
                              aria-label="Resend this prompt"
                              disabled={isStreaming}
                            >
                              <RotateCcw size={13} />
                              <span>Resend</span>
                            </button>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() =>
                                setSavePromptData({
                                  title: 'Saved User Prompt',
                                  template: message.content,
                                })
                              }
                              title="Save to Prompt Vault"
                              aria-label="Save to Prompt Vault"
                            >
                              <BookmarkPlus size={13} />
                              <span>Save to Vault</span>
                            </button>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => {
                                const titleHint =
                                  message.content
                                    .split('\n')[0]
                                    .replace(/^[#*-]+\s*/, '')
                                    .slice(0, 45) || 'User Note';
                                useLibraryStore.getState().openAddModal({
                                  type: 'note',
                                  title: titleHint,
                                  content: message.content,
                                  tags: ['chat', 'note'],
                                });
                              }}
                              title="Save to Library"
                              aria-label="Save to Library"
                            >
                              <BookOpen size={13} />
                              <span>Save to Library</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => handleCopy(message.content, messageId)}
                              title="Copy response"
                              aria-label="Copy response"
                            >
                              {isCopied ? (
                                <Check size={13} className={styles.copiedIcon} />
                              ) : (
                                <Copy size={13} />
                              )}
                              <span>{isCopied ? 'Copied' : 'Copy'}</span>
                            </button>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => handleRetryAssistant(index)}
                              title="Regenerate response"
                              aria-label="Regenerate response"
                              disabled={isStreaming}
                            >
                              <RotateCcw size={13} />
                              <span>Regenerate</span>
                            </button>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() =>
                                setSavePromptData({
                                  title: 'Saved AI Response',
                                  template: message.content,
                                })
                              }
                              title="Save to Prompt Vault"
                              aria-label="Save to Prompt Vault"
                            >
                              <BookmarkPlus size={13} />
                              <span>Save to Vault</span>
                            </button>
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
                              title="Save to Library"
                              aria-label="Save to Library"
                            >
                              <BookOpen size={13} />
                              <span>Save to Library</span>
                            </button>
                            {Boolean(message.thoughts) && (
                              <button
                                type="button"
                                className={cn(styles.actionBtn, styles.thinkingActionBtn)}
                                onClick={() =>
                                  setActiveDrawerThought(message.thoughts || message._id)
                                }
                                title="View AI Reasoning & Thinking Process"
                                aria-label="View AI Reasoning & Thinking Process"
                              >
                                <Brain size={13} className={styles.brainIcon} />
                                <span>Show Thinking</span>
                              </button>
                            )}
                            <button
                              type="button"
                              className={cn(
                                styles.actionBtn,
                                speakingId === messageId && styles.speakingBtn,
                              )}
                              onClick={() => handleToggleSpeak(message.content, messageId)}
                              title={speakingId === messageId ? 'Stop reading aloud' : 'Read aloud'}
                              aria-label={
                                speakingId === messageId ? 'Stop reading aloud' : 'Read aloud'
                              }
                            >
                              {speakingId === messageId ? (
                                <VolumeX size={13} />
                              ) : (
                                <Volume2 size={13} />
                              )}
                              <span>{speakingId === messageId ? 'Stop' : 'Read Aloud'}</span>
                            </button>
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

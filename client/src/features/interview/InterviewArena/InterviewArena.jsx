import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Square,
  Award,
  Copy,
  Check,
  Bot,
  User,
  Clock,
  ArrowLeft,
  Plus,
  Zap,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Code2,
  Sparkles,
  AlertCircle,
  X,
  FastForward,
  FileText,
  Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { InterviewCodeEditor, STARTER_TEMPLATES } from '../InterviewCodeEditor/InterviewCodeEditor';
import { toast } from '@/components/ui/Toast';
import { MarkdownRenderer } from '@/features/chat/MarkdownRenderer/MarkdownRenderer';
import { cn } from '@/lib/utils/cn';
import styles from './InterviewArena.module.scss';

const BENCHMARK_QUESTIONS_TOTAL = 5;

/**
 * Intelligently decomposes an interviewer response into:
 * - Scenario / Context (preceding paragraphs)
 * - Core Question (the prominent final question/prompt)
 */
function parseInterviewerContent(rawText, defaultTopic) {
  if (!rawText) return { scenario: '', question: '', topicTag: defaultTopic };

  const paragraphs = rawText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length <= 1) {
    const sentences = rawText.split(/(?<=[.?!])\s+/);
    if (sentences.length > 2) {
      const qSentences = [];
      const sSentences = [];
      let foundQuestion = false;

      for (let i = sentences.length - 1; i >= 0; i--) {
        const s = sentences[i];
        if (
          !foundQuestion &&
          (s.includes('?') || /^(how|what|why|walk|explain|can you|describe)/i.test(s))
        ) {
          qSentences.unshift(s);
          if (qSentences.length >= 2) foundQuestion = true;
        } else {
          foundQuestion = true;
          sSentences.unshift(s);
        }
      }

      return {
        topicTag: defaultTopic,
        scenario: sSentences.join(' '),
        question: qSentences.join(' ') || rawText,
      };
    }

    return {
      topicTag: defaultTopic,
      scenario: '',
      question: rawText,
    };
  }

  const question = paragraphs[paragraphs.length - 1];
  const scenario = paragraphs.slice(0, paragraphs.length - 1).join('\n\n');

  return {
    topicTag: defaultTopic,
    scenario,
    question,
  };
}

export function InterviewArena({
  session,
  messages = [],
  isStreaming = false,
  isConcluding = false,
  onSendResponse,
  onStopStreaming,
  onConclude,
  onReset,
  isListening = false,
  setIsListening,
  isSpeaking = false,
  speakingSource = null,
  isTtsEnabled = true,
  isTtsLoading = false,
  voiceEngine = 'edge',
  onToggleVoiceEngine,
  onToggleTts,
  onSpeakText,
}) {
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('code'); // 'code' | 'notes'
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [codeContent, setCodeContent] = useState(STARTER_TEMPLATES.javascript);
  const [responseText, setResponseText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPastTurnsOpen, setIsPastTurnsOpen] = useState(false);
  const [showConcludeConfirm, setShowConcludeConfirm] = useState(false);
  const [hasCopiedTranscript, setHasCopiedTranscript] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);
  const menuRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Close more menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMenuOpen]);

  // Track candidate typing for left glowing indicator
  const handleCandidateActivity = useCallback(() => {
    setIsTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1500);
  }, []);

  // Web Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (SpeechRecognition) {
        setIsSpeechSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        let lastProcessedIndex = 0;

        recognition.onstart = () => {
          lastProcessedIndex = 0;
          setIsListening(true);
        };

        recognition.onresult = (event) => {
          const startIndex = Math.max(
            lastProcessedIndex,
            typeof event.resultIndex === 'number' ? event.resultIndex : 0,
          );
          for (let i = startIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              const text = event.results[i][0]?.transcript?.trim();
              if (text) {
                setResponseText((prev) => (prev ? `${prev} ${text}` : text));
                handleCandidateActivity();
              }
              lastProcessedIndex = i + 1;
            }
          }
        };

        recognition.onerror = (e) => {
          setIsListening(false);
          if (e.error !== 'no-speech') {
            toast.error(`Microphone error: ${e.error}`);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } else {
        setIsSpeechSupported(false);
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [setIsListening, handleCandidateActivity]);

  // Toggle Speech-to-Text dictation
  const handleToggleMic = () => {
    if (!isSpeechSupported) {
      toast.info('Speech dictation is not supported in this browser. Please type your response.');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        toast.info('Listening... Speak your response now.');
      } catch {
        toast.error('Could not access microphone.');
      }
    }
  };

  // Submit response
  const handleSubmit = (e) => {
    e?.preventDefault?.();
    let finalPayload = '';

    const hasCode = codeContent && codeContent.trim() && codeContent !== STARTER_TEMPLATES[codeLanguage];
    const hasText = responseText && responseText.trim();

    if (activeWorkspaceTab === 'code') {
      if (hasCode) {
        finalPayload = `\`\`\`${codeLanguage}\n${codeContent.trim()}\n\`\`\`${hasText ? `\n\nExplanation:\n${hasText}` : ''}`;
      } else if (hasText) {
        finalPayload = hasText;
      }
    } else {
      if (hasText) {
        finalPayload = hasText;
        if (hasCode) {
          finalPayload += `\n\n\`\`\`${codeLanguage}\n${codeContent.trim()}\n\`\`\``;
        }
      } else if (hasCode) {
        finalPayload = `\`\`\`${codeLanguage}\n${codeContent.trim()}\n\`\`\``;
      }
    }

    if (!finalPayload.trim() || isStreaming) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    onSendResponse(finalPayload);
    setResponseText('');
  };

  // Skip question
  const handleSkipQuestion = () => {
    if (isStreaming) return;
    onSendResponse('I would like to skip this specific question. Please move on to the next technical topic.');
    setResponseText('');
  };

  // Enter to send, Shift+Enter for newline
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopyTranscript = async () => {
    if (!messages || messages.length === 0) return;
    const transcriptText = messages
      .map(
        (m) =>
          `[${m.role === 'assistant' ? 'EXAMINER' : 'CANDIDATE'} - ${new Date(
            m.timestamp || Date.now(),
          ).toLocaleTimeString()}]\n${m.content}\n`,
      )
      .join('\n---\n\n');

    try {
      await navigator.clipboard.writeText(transcriptText);
      setHasCopiedTranscript(true);
      toast.success('Complete interview transcript copied to clipboard');
      setTimeout(() => setHasCopiedTranscript(false), 2000);
    } catch {
      toast.error('Failed to copy transcript');
    }
  };

  const assistantMessages = useMemo(
    () => messages.filter((m) => m.role === 'assistant'),
    [messages],
  );

  const questionNumber = Math.min(
    BENCHMARK_QUESTIONS_TOTAL,
    Math.max(1, assistantMessages.length),
  );
  const progressPercent = Math.min(
    100,
    Math.round((questionNumber / BENCHMARK_QUESTIONS_TOTAL) * 100),
  );

  const latestAssistantMessage = assistantMessages[assistantMessages.length - 1] || null;

  // Decompose previous completed turns for collapsible history
  const earlierTurns = useMemo(() => {
    if (messages.length <= 1) return [];
    const pairs = [];
    let currentPair = null;

    messages.slice(0, -1).forEach((msg) => {
      if (msg.role === 'assistant') {
        if (currentPair) pairs.push(currentPair);
        currentPair = { question: msg.content, answer: null, timestamp: msg.timestamp };
      } else if (msg.role === 'user' && currentPair) {
        currentPair.answer = msg.content;
        pairs.push(currentPair);
        currentPair = null;
      }
    });

    if (currentPair) pairs.push(currentPair);
    return pairs;
  }, [messages]);

  // Decompose latest question into scenario and prominent question callout
  const parsedQuestion = useMemo(() => {
    return parseInterviewerContent(
      latestAssistantMessage?.content || '',
      session?.topic || 'Technical Screening',
    );
  }, [latestAssistantMessage?.content, session?.topic]);

  const estimatedCreditsUsed = Math.max(1, Math.ceil(messages.length / 2));

  // Determine two-way visual glow states
  const isAiSpeaking = Boolean(isStreaming || (isSpeaking && speakingSource === 'interviewer'));
  const isCandidateActive = Boolean(isListening || isTyping || (isSpeaking && speakingSource === 'candidate'));

  return (
    <div className={styles.arenaContainer}>
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP BAR: Clean, single unified header                      */}
      {/* ------------------------------------------------------------- */}
      <header className={styles.topBar}>
        {/* Left: Back to setup & Role */}
        <div className={styles.navGroup}>
          {onReset && (
            <button
              type="button"
              className={styles.backButton}
              onClick={onReset}
              title="Return to Interview Setup"
              aria-label="Back to Setup"
            >
              <ArrowLeft size={14} />
              <span>Setup</span>
            </button>
          )}

          <div className={styles.roleIdentity}>
            <span className={styles.roleTitle}>{session?.role || 'Technical Interview'}</span>
            <span className={styles.dotSeparator}>·</span>
            <Badge variant="accent" size="sm" className={styles.difficultyBadge}>
              {session?.difficulty}
            </Badge>
          </div>
        </div>

        {/* Center: Progress & Timer */}
        <div className={styles.progressCenter}>
          <div className={styles.progressMeta}>
            <span className={styles.questionCounter}>
              Q {questionNumber}/{BENCHMARK_QUESTIONS_TOTAL}
            </span>
            <div className={styles.progressBarTrack} title={`${progressPercent}% completed`}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className={styles.sessionMetrics}>
            <div className={styles.timerPill} title="Elapsed Interview Time">
              <span className={styles.liveRecordDot} />
              <Clock size={12} />
              <span>{formatTimer(elapsedSeconds)}</span>
            </div>
            <span className={styles.creditEstimateNotice} title="Estimated session credit consumption">
              ~{estimatedCreditsUsed} cr
            </span>
          </div>
        </div>

        {/* Right: Actions Menu & Outlined Conclude */}
        <div className={styles.topBarRight}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowConcludeConfirm(true)}
            loading={isConcluding}
            disabled={isStreaming || isConcluding}
            className={styles.outlinedConcludeBtn}
            leftIcon={<Award size={14} />}
          >
            Conclude
          </Button>

          {/* More Actions Dropdown (⋯) */}
          <div className={styles.moreMenuWrap} ref={menuRef}>
            <button
              type="button"
              className={cn(styles.moreMenuBtn, isMenuOpen && styles.menuOpen)}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="More Options"
              title="More interview options"
            >
              <MoreHorizontal size={16} />
            </button>

            {isMenuOpen && (
              <div className={styles.dropdownPopover} role="menu">
                <div className={styles.dropdownSection}>
                  <span className={styles.dropdownSectionTitle}>Voice Engine</span>
                  <div className={styles.engineSelectRow}>
                    <button
                      type="button"
                      className={cn(
                        styles.engineOptionBtn,
                        voiceEngine === 'edge' && styles.engineOptionActive,
                      )}
                      onClick={() => onToggleVoiceEngine?.('edge')}
                    >
                      <Zap size={12} />
                      <span>Edge Neural (Free)</span>
                    </button>
                    <button
                      type="button"
                      className={cn(
                        styles.engineOptionBtn,
                        voiceEngine === 'gemini' && styles.engineOptionActive,
                      )}
                      onClick={() => onToggleVoiceEngine?.('gemini')}
                    >
                      <Bot size={12} />
                      <span>Gemini TTS</span>
                    </button>
                  </div>
                </div>

                <div className={styles.dropdownDivider} />

                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => onToggleTts()}
                >
                  {isTtsEnabled ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  <span>{isTtsEnabled ? 'Mute AI Voice' : 'Unmute AI Voice'}</span>
                </button>

                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => {
                    handleCopyTranscript();
                    setIsMenuOpen(false);
                  }}
                >
                  <Copy size={14} />
                  <span>Copy Full Transcript</span>
                </button>

                {onReset && (
                  <button
                    type="button"
                    className={styles.dropdownItem}
                    onClick={() => {
                      setIsMenuOpen(false);
                      onReset();
                    }}
                  >
                    <Plus size={14} />
                    <span>Practice New Session</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. MAIN SPLIT COCKPIT: Problem (Left) + LeetCode Editor (Right) */}
      {/* ------------------------------------------------------------- */}
      <main className={styles.splitCockpit}>
        {/* LEFT COLUMN: Problem Statement & Dialogue Context */}
        <section className={styles.problemPane}>
          {/* Active Question Card */}
          <div className={styles.problemCard}>
            <div className={styles.problemHeader}>
              <div className={styles.topicPill}>
                <Sparkles size={12} />
                <span>{parsedQuestion.topicTag}</span>
              </div>

              {/* Compact Audio Status Bar */}
              <div className={styles.audioStatusWrap}>
                {isAiSpeaking ? (
                  <div className={styles.aiSpeakingBadge}>
                    <span className={styles.waveBar} />
                    <span className={styles.waveBar} />
                    <span className={styles.waveBar} />
                    <span>AI Speaking...</span>
                  </div>
                ) : (
                  <div className={styles.aiReadyBadge}>
                    <span className={styles.readyDot} />
                    <span>Ready</span>
                  </div>
                )}

                {latestAssistantMessage && !isStreaming && (
                  <button
                    type="button"
                    className={styles.replayMiniBtn}
                    onClick={() => onSpeakText(latestAssistantMessage.content)}
                    title="Replay audio"
                    aria-label="Replay audio"
                  >
                    <Volume2 size={12} />
                    <span>Replay</span>
                  </button>
                )}
              </div>
            </div>

            <div className={styles.problemBody}>
              {parsedQuestion.scenario && (
                <div className={styles.scenarioBlock}>
                  <MarkdownRenderer content={parsedQuestion.scenario} />
                </div>
              )}

              {parsedQuestion.question ? (
                <div className={styles.calloutBlock}>
                  <span className={styles.calloutAccent} />
                  <div className={styles.calloutContent}>
                    <MarkdownRenderer
                      content={parsedQuestion.question}
                      isStreaming={isStreaming}
                    />
                  </div>
                </div>
              ) : (
                <p className={styles.placeholderPrompt}>
                  Formulating technical screening question...
                </p>
              )}

              {isStreaming && (
                <div className={styles.typingWave}>
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                </div>
              )}
            </div>
          </div>

          {/* Collapsible History: Earlier Turns */}
          {earlierTurns.length > 0 && (
            <div className={styles.pastTurnsAccordion}>
              <button
                type="button"
                className={styles.accordionHeaderBtn}
                onClick={() => setIsPastTurnsOpen(!isPastTurnsOpen)}
                aria-expanded={isPastTurnsOpen}
              >
                <div className={styles.accordionTitle}>
                  {isPastTurnsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>Earlier Turns ({earlierTurns.length})</span>
                </div>
                <span className={styles.accordionHint}>
                  {isPastTurnsOpen ? 'Collapse' : 'Review previous Q&A'}
                </span>
              </button>

              {isPastTurnsOpen && (
                <div className={styles.pastTurnsContent}>
                  {earlierTurns.map((turn, idx) => (
                    <div key={idx} className={styles.pastTurnItem}>
                      <div className={styles.pastQuestionBox}>
                        <span className={styles.pastSpeakerLabel}>Q{idx + 1} Examiner</span>
                        <p className={styles.pastText}>{turn.question}</p>
                      </div>
                      {turn.answer && (
                        <div className={styles.pastAnswerBox}>
                          <span className={styles.pastCandidateLabel}>You</span>
                          <p className={styles.pastText}>{turn.answer}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* RIGHT COLUMN: Candidate Workspace with Two-Way Reactive Glow */}
        <section
          className={cn(
            styles.workspacePane,
            isAiSpeaking && styles.glowRight,
            isCandidateActive && styles.glowLeft,
          )}
        >
          {/* Workspace Tabs Header */}
          <div className={styles.workspaceTabBar}>
            <div className={styles.tabGroup}>
              <button
                type="button"
                className={cn(
                  styles.tabButton,
                  activeWorkspaceTab === 'code' && styles.activeTab,
                )}
                onClick={() => setActiveWorkspaceTab('code')}
              >
                <Code2 size={13} />
                <span>Code Solution</span>
              </button>

              <button
                type="button"
                className={cn(
                  styles.tabButton,
                  activeWorkspaceTab === 'notes' && styles.activeTab,
                )}
                onClick={() => setActiveWorkspaceTab('notes')}
              >
                <FileText size={13} />
                <span>Verbal / Text Explanation</span>
              </button>
            </div>

            <div className={styles.workspaceStatusBadge}>
              {isAiSpeaking && <span className={styles.aiTurnBadge}>AI Turn</span>}
              {isCandidateActive && <span className={styles.candidateTurnBadge}>Your Turn</span>}
              {!isAiSpeaking && !isCandidateActive && <span className={styles.idleTurnBadge}>Ready to Code</span>}
            </div>
          </div>

          {/* Workspace Canvas */}
          <div className={styles.workspaceCanvas}>
            {activeWorkspaceTab === 'code' ? (
              <div className={styles.editorWrap}>
                <InterviewCodeEditor
                  code={codeContent}
                  onChange={(val) => {
                    setCodeContent(val);
                    handleCandidateActivity();
                  }}
                  language={codeLanguage}
                  onLanguageChange={(lang) => {
                    setCodeLanguage(lang);
                    if (!codeContent.trim() || codeContent === STARTER_TEMPLATES[codeLanguage]) {
                      setCodeContent(STARTER_TEMPLATES[lang] || STARTER_TEMPLATES.javascript);
                    }
                  }}
                  isExecuting={isStreaming}
                />
              </div>
            ) : (
              <div className={styles.notesWrap}>
                <textarea
                  ref={textareaRef}
                  className={styles.notesTextarea}
                  placeholder={
                    isListening
                      ? 'Listening to microphone... speak clearly...'
                      : 'Articulate your reasoning, architectural trade-offs, algorithms, or verbal answer here...'
                  }
                  value={responseText}
                  onChange={(e) => {
                    setResponseText(e.target.value);
                    handleCandidateActivity();
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={isStreaming}
                />
              </div>
            )}
          </div>

          {/* Action Footer Bar */}
          <div className={styles.actionBar}>
            <div className={styles.actionLeft}>
              <button
                type="button"
                className={cn(
                  styles.micButton,
                  isListening && styles.recordingActive,
                  !isSpeechSupported && styles.disabledMic,
                )}
                onClick={handleToggleMic}
                title={
                  !isSpeechSupported
                    ? 'Speech dictation not supported'
                    : isListening
                      ? 'Stop microphone'
                      : 'Start speech-to-text dictation'
                }
                aria-label={isListening ? 'Stop recording' : 'Start microphone'}
              >
                {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                <span>{isListening ? 'Listening...' : 'Voice Dictate'}</span>
              </button>
            </div>

            <div className={styles.actionRight}>
              <button
                type="button"
                className={styles.skipQuestionBtn}
                onClick={handleSkipQuestion}
                disabled={isStreaming}
                title="Skip this question"
              >
                <FastForward size={13} />
                <span>Skip</span>
              </button>

              {isStreaming ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onStopStreaming}
                  leftIcon={<Square size={13} />}
                >
                  Stop
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleSubmit}
                  className={styles.submitAnswerBtn}
                  leftIcon={<Send size={13} />}
                >
                  Submit Answer
                </Button>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* 3. Conclude Confirmation Modal Dialog                         */}
      {/* ------------------------------------------------------------- */}
      {showConcludeConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setShowConcludeConfirm(false)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmHeader}>
              <div className={styles.confirmIconWrap}>
                <Award size={18} className={styles.confirmAwardIcon} />
              </div>
              <h3>Conclude Technical Interview?</h3>
            </div>
            <p className={styles.confirmBody}>
              Are you ready to submit your interview session for comprehensive AI competency
              evaluation? A full scorecard and performance report will be generated.
            </p>
            <div className={styles.confirmActions}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowConcludeConfirm(false)}
                disabled={isConcluding}
              >
                Continue Interview
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setShowConcludeConfirm(false);
                  onConclude();
                }}
                loading={isConcluding}
                leftIcon={<Award size={14} />}
              >
                Conclude & Grade
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

InterviewArena.propTypes = {
  session: PropTypes.shape({
    _id: PropTypes.string,
    role: PropTypes.string,
    difficulty: PropTypes.string,
    topic: PropTypes.string,
  }),
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      role: PropTypes.string,
      content: PropTypes.string,
      timestamp: PropTypes.any,
    }),
  ),
  isStreaming: PropTypes.bool,
  isConcluding: PropTypes.bool,
  onSendResponse: PropTypes.func.isRequired,
  onStopStreaming: PropTypes.func,
  onConclude: PropTypes.func.isRequired,
  onReset: PropTypes.func,
  isListening: PropTypes.bool,
  setIsListening: PropTypes.func,
  isSpeaking: PropTypes.bool,
  speakingSource: PropTypes.string,
  isTtsEnabled: PropTypes.bool,
  isTtsLoading: PropTypes.bool,
  voiceEngine: PropTypes.string,
  onToggleVoiceEngine: PropTypes.func,
  onToggleTts: PropTypes.func,
  onSpeakText: PropTypes.func,
};

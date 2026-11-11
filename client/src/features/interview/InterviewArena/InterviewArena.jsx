import { useState, useEffect, useRef, useMemo } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { VoiceRipple } from '../VoiceRipple/VoiceRipple';
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
    // If only one paragraph, check for question mark sentences at the end
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
  const [responseText, setResponseText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPastTurnsOpen, setIsPastTurnsOpen] = useState(false);
  const [showConcludeConfirm, setShowConcludeConfirm] = useState(false);
  const [hasCopiedTranscript, setHasCopiedTranscript] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);
  const menuRef = useRef(null);

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
    };
  }, [setIsListening]);

  // Auto-grow textarea
  const handleTextareaInput = (e) => {
    setResponseText(e.target.value);
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(260, Math.max(88, target.scrollHeight))}px`;
  };

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
        toast.info('Listening... Speak your answer now.');
      } catch {
        toast.error('Could not access microphone.');
      }
    }
  };

  // Insert code block helper
  const handleInsertCodeSnippet = () => {
    const snippet = '```javascript\n// Write code implementation here\n\n```';
    setResponseText((prev) => (prev ? `${prev}\n\n${snippet}` : snippet));
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.style.height = `${Math.min(260, Math.max(88, textareaRef.current.scrollHeight))}px`;
      }
    }, 0);
  };

  // Submit response
  const handleSubmit = (e) => {
    e?.preventDefault?.();
    const trimmed = responseText.trim();
    if (!trimmed || isStreaming) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    onSendResponse(trimmed);
    setResponseText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Skip question
  const handleSkipQuestion = () => {
    if (isStreaming) return;
    onSendResponse("I would like to skip this specific question. Please move on to the next technical topic.");
    setResponseText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Enter to send, Shift+Enter for newline
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Copy full transcript
  const handleCopyTranscript = async () => {
    const text = messages
      .map(
        (m) =>
          `[${m.role === 'assistant' ? 'Interviewer' : 'Candidate'} - ${new Date(
            m.timestamp || Date.now(),
          ).toLocaleTimeString()}]:\n${m.content}\n`,
      )
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setHasCopiedTranscript(true);
      toast.success('Transcript copied to clipboard');
      setTimeout(() => setHasCopiedTranscript(false), 2500);
    } catch {
      toast.error('Failed to copy transcript');
    }
  };

  // Message grouping & past turns
  const assistantMessages = messages.filter((m) => m.role === 'assistant');
  const latestAssistantMessage = assistantMessages[assistantMessages.length - 1];
  const questionNumber = assistantMessages.length || 1;
  const progressPercent = Math.min(
    100,
    Math.round((questionNumber / BENCHMARK_QUESTIONS_TOTAL) * 100),
  );

  // Group earlier turns into Q&A pairs
  const earlierTurns = useMemo(() => {
    if (assistantMessages.length <= 1) return [];
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
  }, [messages, assistantMessages.length]);

  // Topic checklist items parsed from session topic
  const topicChecklist = useMemo(() => {
    const raw = session?.topic || 'Architecture, Design, Best Practices';
    const parts = raw
      .split(/[,&/]/)
      .map((s) => s.trim())
      .filter(Boolean);

    return parts.slice(0, 4).map((part, idx) => {
      let status = 'pending';
      if (idx < questionNumber - 1) status = 'done';
      else if (idx === questionNumber - 1) status = 'current';
      return { label: part, status };
    });
  }, [session?.topic, questionNumber]);

  // Decompose latest question into scenario and prominent question callout
  const parsedQuestion = useMemo(() => {
    return parseInterviewerContent(
      latestAssistantMessage?.content || '',
      session?.topic || 'Technical Screening',
    );
  }, [latestAssistantMessage?.content, session?.topic]);

  const wordCount = responseText.trim() ? responseText.trim().split(/\s+/).length : 0;
  const estimatedCreditsUsed = Math.max(1, Math.ceil(messages.length / 2));

  // Determine state label directly under orb
  const getOrbState = () => {
    if (isStreaming) return { label: 'Thinking', class: styles.stateThinking };
    if (isListening) return { label: 'Listening', class: styles.stateListening };
    if (isSpeaking && speakingSource === 'interviewer') {
      return {
        label: voiceEngine === 'edge' ? 'Speaking (Edge)' : 'Speaking (Gemini)',
        class: styles.stateSpeaking,
      };
    }
    return { label: 'Ready', class: styles.stateReady };
  };

  const orbState = getOrbState();

  return (
    <div className={styles.arenaContainer}>
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP BAR: Single row, clean, uncrowded                      */}
      {/* ------------------------------------------------------------- */}
      <header className={styles.topBar}>
        {/* Left: Back & Role */}
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
              Session: ~{estimatedCreditsUsed} cr
            </span>
          </div>
        </div>

        {/* Right: Outlined Conclude & More Menu */}
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
              <MoreHorizontal size={17} />
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
                      onClick={() => {
                        onToggleVoiceEngine?.('edge');
                      }}
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
                      onClick={() => {
                        onToggleVoiceEngine?.('gemini');
                      }}
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
                  onClick={() => {
                    onToggleTts();
                  }}
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
      {/* 2. MAIN COCKPIT: Left Examiner (260px) + Right Interaction    */}
      {/* ------------------------------------------------------------- */}
      <main className={styles.cockpitGrid}>
        {/* LEFT PANEL: Examiner Orb & Topics Checklist */}
        <aside className={styles.examinerPanel}>
          <Card className={styles.examinerCard} padding="md">
            <div className={styles.examinerHeader}>
              <div className={styles.examinerBadge}>
                <Bot size={14} className={styles.examinerBotIcon} />
                <span>EXAMINER</span>
              </div>
              <span className={styles.examinerSub}>{session?.difficulty} Tech Lead</span>
            </div>

            {/* Speaking Pulse Orb */}
            <div className={styles.orbContainer}>
              <VoiceRipple
                isSpeaking={isSpeaking || isStreaming || isListening}
                source={
                  speakingSource ||
                  (isListening ? 'candidate' : isStreaming ? 'interviewer' : 'idle')
                }
                size="md"
              />
            </div>

            {/* State Text Directly Under Orb */}
            <div className={styles.orbStateRow}>
              <span className={cn(styles.orbStateText, orbState.class)}>
                {orbState.label}
              </span>

              {latestAssistantMessage && !isStreaming && (
                <button
                  type="button"
                  className={styles.miniReplayBtn}
                  onClick={() => onSpeakText(latestAssistantMessage.content)}
                  title="Replay question voice"
                  aria-label="Replay audio"
                >
                  <Volume2 size={12} />
                  <span>Replay</span>
                </button>
              )}
            </div>

            {/* Topics Covered Checklist */}
            <div className={styles.topicsSection}>
              <span className={styles.topicsHeader}>Track Topics</span>
              <ul className={styles.topicsList}>
                {topicChecklist.map((item, idx) => (
                  <li
                    key={idx}
                    className={cn(
                      styles.topicItem,
                      item.status === 'done' && styles.topicDone,
                      item.status === 'current' && styles.topicCurrent,
                      item.status === 'pending' && styles.topicPending,
                    )}
                  >
                    <span className={styles.topicStatusIcon}>
                      {item.status === 'done' ? (
                        <Check size={11} />
                      ) : item.status === 'current' ? (
                        '●'
                      ) : (
                        '○'
                      )}
                    </span>
                    <span className={styles.topicName}>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </aside>

        {/* RIGHT AREA: Question Card + Answer Composer */}
        <section className={styles.interactionArea}>
          {/* Collapsible Earlier Turns Thread (▸ Q1, Q2...) */}
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
                  {isPastTurnsOpen ? 'Collapse' : 'Click to review previous Q&A'}
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

          {/* Current Structured Question Card */}
          <Card className={styles.questionCard} padding="lg">
            <div className={styles.questionHeader}>
              <div className={styles.questionTopicBadge}>
                <Sparkles size={12} />
                <span>{parsedQuestion.topicTag}</span>
              </div>
              <span className={styles.questionTurnLabel}>
                Question {questionNumber} of {BENCHMARK_QUESTIONS_TOTAL}
              </span>
            </div>

            <div className={styles.questionBody}>
              {/* Scenario Context (Muted, 2-3 lines, capped width) */}
              {parsedQuestion.scenario && (
                <div className={styles.scenarioContext}>
                  <MarkdownRenderer content={parsedQuestion.scenario} />
                </div>
              )}

              {/* Core Question (Bold, prominent callout box) */}
              {parsedQuestion.question ? (
                <div className={styles.questionCallout}>
                  <span className={styles.calloutAccentBar} />
                  <div className={styles.calloutText}>
                    <MarkdownRenderer
                      content={parsedQuestion.question}
                      isStreaming={isStreaming}
                    />
                  </div>
                </div>
              ) : (
                <p className={styles.placeholderNotice}>
                  Formulating technical screening question...
                </p>
              )}

              {/* Streaming typing animation */}
              {isStreaming && (
                <div className={styles.typingIndicator}>
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                </div>
              )}
            </div>
          </Card>

          {/* Modern Answer Composer Card */}
          <Card className={styles.composerCard} padding="sm">
            {/* Header: Response label & Insert Code helper */}
            <div className={styles.composerHeader}>
              <span className={styles.composerLabel}>Your Response</span>
              <button
                type="button"
                className={styles.insertCodeBtn}
                onClick={handleInsertCodeSnippet}
                title="Insert markdown code block"
              >
                <Code2 size={13} />
                <span>Insert Code</span>
              </button>
            </div>

            {/* Auto-growing Textarea */}
            <form className={styles.composerForm} onSubmit={handleSubmit}>
              <div className={styles.textareaWrap}>
                <textarea
                  ref={textareaRef}
                  className={styles.autoGrowTextarea}
                  rows={3}
                  placeholder={
                    isListening
                      ? 'Listening to microphone... speak clearly, or type here...'
                      : 'Articulate your response, reasoning, trade-offs, and architecture...'
                  }
                  value={responseText}
                  onChange={handleTextareaInput}
                  onKeyDown={handleKeyDown}
                  disabled={isStreaming}
                />

                {/* Microphone Recording Overlay Pill */}
                {isListening && (
                  <div className={styles.recordingOverlay}>
                    <span className={styles.recordPulseDot} />
                    <span className={styles.recordWave}>Listening to microphone...</span>
                  </div>
                )}
              </div>

              {/* Footer Toolbar */}
              <div className={styles.composerFooter}>
                <div className={styles.footerLeft}>
                  {/* Word Count */}
                  <span className={styles.wordCountBadge}>
                    {wordCount} {wordCount === 1 ? 'word' : 'words'}
                  </span>

                  {/* Mic Dictation Toggle */}
                  <button
                    type="button"
                    className={cn(
                      styles.micToggleBtn,
                      isListening && styles.micRecording,
                      !isSpeechSupported && styles.micDisabled,
                    )}
                    onClick={handleToggleMic}
                    title={
                      !isSpeechSupported
                        ? 'Speech dictation not supported'
                        : isListening
                          ? 'Stop voice recording'
                          : 'Start speech-to-text dictation'
                    }
                    aria-label={isListening ? 'Stop recording' : 'Start microphone'}
                  >
                    {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                    <span>{isListening ? 'Recording' : 'Voice'}</span>
                  </button>
                </div>

                <div className={styles.footerRight}>
                  <span className={styles.enterKeyHint}>
                    <kbd>Enter ↵</kbd> submit · <kbd>Shift+Enter</kbd> newline
                  </span>

                  {/* Skip Question Button */}
                  <button
                    type="button"
                    className={styles.skipBtn}
                    onClick={handleSkipQuestion}
                    disabled={isStreaming}
                    title="Skip this question"
                  >
                    <FastForward size={13} />
                    <span>Skip</span>
                  </button>

                  {/* Submit / Stop Button */}
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
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={!responseText.trim() || isStreaming}
                      className={styles.submitBtn}
                      leftIcon={<Send size={13} />}
                    >
                      Submit
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Card>
        </section>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* 3. Conclude Confirmation Dialog                               */}
      {/* ------------------------------------------------------------- */}
      {showConcludeConfirm && (
        <div className={styles.modalBackdrop} onClick={() => setShowConcludeConfirm(false)}>
          <div
            className={styles.confirmDialog}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-labelledby="conclude-title"
          >
            <div className={styles.dialogHeader}>
              <div className={styles.dialogIconWrap}>
                <AlertCircle size={20} className={styles.dialogIcon} />
              </div>
              <div>
                <h4 id="conclude-title" className={styles.dialogTitle}>
                  Conclude Interview Session?
                </h4>
                <p className={styles.dialogDesc}>
                  Your interview transcript will be finalized and evaluated by Gemini against
                  industry competency benchmarks to generate your scorecard report.
                </p>
              </div>
              <button
                type="button"
                className={styles.dialogCloseBtn}
                onClick={() => setShowConcludeConfirm(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.dialogActions}>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setShowConcludeConfirm(false)}
              >
                Keep Practicing
              </Button>
              <Button
                variant="danger"
                size="md"
                loading={isConcluding}
                onClick={() => {
                  setShowConcludeConfirm(false);
                  onConclude();
                }}
                leftIcon={<Award size={15} />}
              >
                End & Evaluate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

InterviewArena.propTypes = {
  session: PropTypes.object.isRequired,
  messages: PropTypes.array.isRequired,
  isStreaming: PropTypes.bool,
  isConcluding: PropTypes.bool,
  onSendResponse: PropTypes.func.isRequired,
  onStopStreaming: PropTypes.func.isRequired,
  onConclude: PropTypes.func.isRequired,
  onReset: PropTypes.func,
  isListening: PropTypes.bool,
  setIsListening: PropTypes.func.isRequired,
  isSpeaking: PropTypes.bool,
  speakingSource: PropTypes.string,
  isTtsEnabled: PropTypes.bool,
  isTtsLoading: PropTypes.bool,
  voiceEngine: PropTypes.oneOf(['edge', 'gemini']),
  onToggleVoiceEngine: PropTypes.func,
  onToggleTts: PropTypes.func.isRequired,
  onSpeakText: PropTypes.func.isRequired,
};

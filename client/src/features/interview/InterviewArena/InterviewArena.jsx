import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Square,
  Award,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Bot,
  User,
  Clock,
  ArrowLeft,
  Plus,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { VoiceRipple } from '../VoiceRipple/VoiceRipple';
import { toast } from '@/components/ui/Toast';
import { MarkdownRenderer } from '@/features/chat/MarkdownRenderer/MarkdownRenderer';
import { cn } from '@/lib/utils/cn';
import styles from './InterviewArena.module.scss';

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
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [hasCopiedTranscript, setHasCopiedTranscript] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);
  const transcriptBottomRef = useRef(null);

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

  // Initialize Web Speech Recognition
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

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              const text = event.results[i][0].transcript;
              setResponseText((prev) => (prev ? `${prev} ${text}` : text));
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

  // Latest interviewer question
  const assistantMessages = messages.filter((m) => m.role === 'assistant');
  const latestAssistantMessage = assistantMessages[assistantMessages.length - 1];

  return (
    <div className={styles.arenaContainer}>
      {/* Top Session Bar */}
      <header className={styles.topBar}>
        <div className={styles.sessionInfo}>
          {onReset && (
            <div className={styles.navRow}>
              <button
                type="button"
                className={styles.backButton}
                onClick={onReset}
                title="Return to Interview Setup"
                aria-label="Back to Setup"
              >
                <ArrowLeft size={14} />
                <span>Back to Setup</span>
              </button>
            </div>
          )}
          <div className={styles.titleRow}>
            <h2 className={styles.roleTitle}>{session?.role || 'Technical Interview'}</h2>
            <Badge variant="accent" size="sm" className={styles.diffBadge}>
              {session?.difficulty}
            </Badge>
            {session?.isSimulation ? (
              <Badge tone="warning" size="sm" className={styles.simBadge}>
                ⚡ Simulation (0 Credits)
              </Badge>
            ) : voiceEngine === 'edge' ? (
              <Badge tone="accent" size="sm" className={styles.simBadge}>
                ⚡ Edge Neural (Fast & Free)
              </Badge>
            ) : (
              <Badge tone="success" size="sm" className={styles.simBadge}>
                🎙️ Gemini 3.8 Flash-Lite TTS
              </Badge>
            )}
          </div>
          <p className={styles.topicSubtitle} title={session?.topic}>
            {session?.topic}
          </p>
        </div>

        <div className={styles.topActions}>
          <div className={styles.timerPill} title="Elapsed Interview Time">
            <Clock size={14} />
            <span>{formatTimer(elapsedSeconds)}</span>
          </div>

          {/* Dual-Engine Voice Selector */}
          {!session?.isSimulation && (
            <div className={styles.engineToggleGroup} role="radiogroup" aria-label="Voice Engine">
              <button
                type="button"
                className={cn(
                  styles.enginePillBtn,
                  voiceEngine === 'edge' && styles.enginePillActive,
                )}
                onClick={() => onToggleVoiceEngine && onToggleVoiceEngine('edge')}
                title="⚡ Edge Neural: ~400ms ultra-low latency, studio-quality, 0 credits"
                aria-pressed={voiceEngine === 'edge'}
              >
                <Zap size={12} />
                <span>Edge Neural</span>
              </button>
              <button
                type="button"
                className={cn(
                  styles.enginePillBtn,
                  voiceEngine === 'gemini' && styles.enginePillActive,
                )}
                onClick={() => onToggleVoiceEngine && onToggleVoiceEngine('gemini')}
                title="🎙️ Gemini 3.8 Flash-Lite TTS: Cloud neural voice (Metered credits)"
                aria-pressed={voiceEngine === 'gemini'}
              >
                <Bot size={12} />
                <span>Gemini 3.8 TTS</span>
              </button>
            </div>
          )}

          <button
            type="button"
            className={cn(
              styles.audioToggleBtn,
              isTtsEnabled && styles.ttsActive,
              isTtsLoading && styles.ttsLoading,
            )}
            onClick={onToggleTts}
            title={
              isTtsLoading
                ? voiceEngine === 'edge'
                  ? 'Synthesizing voice with Edge Neural TTS...'
                  : 'Synthesizing voice with Gemini 3.8 Flash-Lite TTS...'
                : isTtsEnabled
                  ? session?.isSimulation
                    ? 'AI Voice: Browser Web Speech (Simulation) - Click to Mute'
                    : voiceEngine === 'edge'
                      ? 'AI Voice: Edge Neural TTS (Free) - Click to Mute'
                      : 'AI Voice: Gemini 3.8 Flash-Lite TTS - Click to Mute'
                  : 'AI Voice Muted - Click to Enable'
            }
            aria-label="Toggle voice readout"
          >
            {isTtsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {onReset && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onReset}
              className={styles.newInterviewBtn}
              leftIcon={<Plus size={14} />}
              title="Configure a new interview session"
            >
              Practice New
            </Button>
          )}

          <Button
            variant="danger"
            size="sm"
            onClick={onConclude}
            loading={isConcluding}
            disabled={isStreaming || isConcluding}
            className={styles.concludeBtn}
            leftIcon={<Award size={15} />}
          >
            Conclude & Evaluate
          </Button>
        </div>
      </header>

      {/* Main Simulation Stage */}
      <main className={styles.stageGrid}>
        {/* Center Stage: Interviewer Persona & Voice Ripple */}
        <div className={styles.interviewerStage}>
          <div className={styles.visualizerArea}>
            <VoiceRipple
              isSpeaking={isSpeaking || isStreaming || isListening}
              source={speakingSource || (isListening ? 'candidate' : isStreaming ? 'interviewer' : 'idle')}
              size="lg"
              statusText={
                isStreaming
                  ? 'Interviewer is thinking & formulating critique...'
                  : isListening
                    ? 'Microphone active — speaking answer...'
                    : isTtsLoading
                      ? voiceEngine === 'edge'
                        ? 'Synthesizing Edge Neural voice...'
                        : 'Generating Gemini 3.8 Flash-Lite TTS audio...'
                      : isSpeaking && speakingSource === 'interviewer'
                        ? session?.isSimulation
                          ? 'Interviewer is speaking (Web Speech Simulation)...'
                          : voiceEngine === 'edge'
                            ? 'Interviewer is speaking (Edge Neural)...'
                            : 'Interviewer is speaking (Gemini 3.8 Flash-Lite TTS)...'
                        : 'Interviewer waiting for your response'
              }
            />
          </div>

          {/* Current Question / Critique Card */}
          <Card className={styles.questionCard} padding="lg">
            <div className={styles.questionHeader}>
              <div className={styles.interviewerMeta}>
                <Bot size={18} className={styles.interviewerIcon} />
                <span className={styles.interviewerLabel}>
                  {session?.difficulty?.toUpperCase()} TECH LEAD EXAMINER
                </span>
              </div>

              {latestAssistantMessage && !isStreaming && (
                <button
                  type="button"
                  className={styles.replayBtn}
                  onClick={() => onSpeakText(latestAssistantMessage.content)}
                  title="Replay question audio"
                  aria-label="Replay audio"
                >
                  <Volume2 size={14} />
                  <span>Replay</span>
                </button>
              )}
            </div>

            <div className={styles.questionBody}>
              {latestAssistantMessage ? (
                <div className={styles.questionText}>
                  <MarkdownRenderer
                    content={latestAssistantMessage.content}
                    isStreaming={isStreaming}
                  />
                </div>
              ) : (
                <p className={styles.placeholderText}>Initializing interview session...</p>
              )}

              {isStreaming && (
                <span className={styles.typingIndicator}>
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                </span>
              )}
            </div>
          </Card>
        </div>

        {/* Collapsible Live Transcript Tray */}
        <div className={styles.transcriptSection}>
          <button
            type="button"
            className={styles.transcriptToggle}
            onClick={() => setIsTranscriptOpen(!isTranscriptOpen)}
            aria-expanded={isTranscriptOpen}
          >
            <span className={styles.transcriptTitle}>
              Transcript History ({messages.length} {messages.length === 1 ? 'turn' : 'turns'})
            </span>
            {isTranscriptOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {isTranscriptOpen && (
            <div className={styles.transcriptContent}>
              <div className={styles.transcriptActions}>
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={handleCopyTranscript}
                  title="Copy full transcript"
                >
                  {hasCopiedTranscript ? <Check size={13} /> : <Copy size={13} />}
                  <span>{hasCopiedTranscript ? 'Copied' : 'Copy Transcript'}</span>
                </button>
              </div>

              <div className={styles.messageScroll}>
                {messages.map((m, idx) => {
                  const isUser = m.role === 'user';
                  return (
                    <div
                      key={idx}
                      className={cn(
                        styles.transcriptMessage,
                        isUser ? styles.userTurn : styles.assistantTurn,
                      )}
                    >
                      <div className={styles.msgHeader}>
                        <span className={styles.msgRole}>
                          {isUser ? <User size={12} /> : <Bot size={12} />}
                          {isUser ? 'Candidate' : 'Interviewer'}
                        </span>
                        <span className={styles.msgTime}>
                          {new Date(m.timestamp || Date.now()).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className={styles.msgContent}>
                        <MarkdownRenderer content={m.content} />
                      </div>
                    </div>
                  );
                })}
                <div ref={transcriptBottomRef} />
              </div>
            </div>
          )}
        </div>

        {/* Candidate Response Composer */}
        <div className={styles.composerSection}>
          <form className={styles.composerForm} onSubmit={handleSubmit}>
            <div className={styles.inputWrapper}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                rows={3}
                placeholder={
                  isListening
                    ? 'Listening to microphone... speak clearly, or type here...'
                    : 'Articulate your technical response, reasoning, trade-offs, and architecture...'
                }
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
              />

              <div className={styles.inputActions}>
                {/* Voice Dictation Button */}
                <button
                  type="button"
                  className={cn(
                    styles.micButton,
                    isListening && styles.micActive,
                    !isSpeechSupported && styles.micDisabled,
                  )}
                  onClick={handleToggleMic}
                  title={
                    !isSpeechSupported
                      ? 'Speech recognition not supported in this browser'
                      : isListening
                        ? 'Stop speech dictation'
                        : 'Start voice dictation (Web Speech API)'
                  }
                  aria-label={isListening ? 'Stop recording voice' : 'Start recording voice'}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                  <span className={styles.micStatusText}>
                    {isListening ? 'Recording...' : 'Voice Input'}
                  </span>
                </button>

                <div className={styles.submitGroup}>
                  {isStreaming ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={onStopStreaming}
                      className={styles.stopBtn}
                      leftIcon={<Square size={14} />}
                    >
                      Stop
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      disabled={!responseText.trim() || isStreaming}
                      className={styles.sendBtn}
                      leftIcon={<Send size={15} />}
                    >
                      Submit Answer
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </form>
          <span className={styles.hintText}>
            Tip: Press <kbd>Enter</kbd> to submit answer, <kbd>Shift+Enter</kbd> for newline.
          </span>
        </div>
      </main>
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

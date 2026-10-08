import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Plus,
  Mic,
  MicOff,
  ArrowUp,
  HelpCircle,
  Code2,
  Mail,
  Server,
  Terminal,
  Zap,
  Brain,
} from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { AttachContextModal } from '../ChatInput/AttachContextModal';
import { AttachedContextPreview } from '../ChatInput/AttachedContextPreview';
import { PromptPickerModal, VariableFillModal } from '@/features/prompts';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { getGreetingContext } from './greetingHelper';
import { cn } from '@/lib/utils/cn';
import logoImg from '@/assets/logo.png';
import styles from './ChatHero.module.scss';


const STARTER_PROMPTS = [
  {
    icon: <HelpCircle size={17} />,
    title: 'Explain a Concept',
    prompt: 'Explain quantum computing in simple, intuitive terms.',
  },
  {
    icon: <Code2 size={17} />,
    title: 'Code Assistance',
    prompt: 'Write a Python script to parse and transform a CSV dataset.',
  },
  {
    icon: <Mail size={17} />,
    title: 'Professional Writing',
    prompt: 'Draft a polite follow-up email after a job interview.',
  },
  {
    icon: <Server size={17} />,
    title: 'System Architecture',
    prompt: 'Design a scalable caching strategy for an API using Redis.',
  },
];

export function ChatHero({ onSendPrompt, initialPrompt, onClearInitialPrompt }) {
  const user = useAuthStore((state) => state.user);
  const greeting = getGreetingContext(user);

  const {
    isStreaming,
    isSimulation,
    toggleSimulation,
    thinkingLevel,
    setThinkingLevel,
  } = useChatStore();

  const handleCycleThinking = () => {
    const levels = ['off', 'low', 'medium', 'high'];
    const currentIndex = levels.indexOf(thinkingLevel);
    const nextIndex = (currentIndex + 1) % levels.length;
    setThinkingLevel(levels[nextIndex]);
  };

  const [input, setInput] = useState('');
  const [attachedContext, setAttachedContext] = useState(null);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [selectedPromptForVariables, setSelectedPromptForVariables] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const baseTextRef = useRef('');

  const insertCompiledPrompt = (compiledText) => {
    setInput((prev) => {
      const next = prev ? `${prev}\n\n${compiledText}` : compiledText;
      baseTextRef.current = next;
      return next;
    });
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.value.length;
        textareaRef.current.selectionEnd = textareaRef.current.value.length;
      }
    }, 0);
  };

  const handleSelectPrompt = (prompt) => {
    if (prompt.variables && prompt.variables.length > 0) {
      setSelectedPromptForVariables(prompt);
    } else {
      insertCompiledPrompt(prompt.template);
    }
  };

  // Handle external prefill from Prompt Vault
  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
      baseTextRef.current = initialPrompt;
      onClearInitialPrompt?.();
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [initialPrompt, onClearInitialPrompt]);

  // Web Speech API Voice Dictation Hook with Real-Time Streaming
  const { isSupported: isVoiceSupported, isListening, stopListening, toggleListening } = useSpeechRecognition({
    continuous: true,
    onInterim: (interim) => {
      const base = baseTextRef.current;
      if (interim) {
        setInput(base ? `${base} ${interim}` : interim);
      } else {
        setInput(base);
      }
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    },
    onResult: (transcription) => {
      const base = baseTextRef.current;
      const updated = base ? `${base} ${transcription}` : transcription;
      baseTextRef.current = updated;
      setInput(updated);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    },
  });

  const handleToggleListening = () => {
    if (!isListening) {
      baseTextRef.current = input;
    }
    toggleListening();
  };

  // Adjust textarea height dynamically with smooth auto-grow up to 220px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      const minH = 28;
      const maxH = 220;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollH, minH), maxH)}px`;
    }
  }, [input]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (isListening) {
      stopListening();
    }
    const trimmed = input.trim();
    if ((!trimmed && !attachedContext) || isStreaming) {
      return;
    }

    let finalPrompt = trimmed;
    const attachments = [];

    if (attachedContext) {
      if (attachedContext.data) {
        attachments.push({
          name: attachedContext.name,
          mimeType: attachedContext.mimeType,
          data: attachedContext.data,
          size: attachedContext.size,
        });
        if (!finalPrompt) {
          finalPrompt = `[Analyzed ${attachedContext.type || "file"}: ${attachedContext.name}]`;
        }
      } else {
        const prefix = `[Attached Context: ${attachedContext.name} (${attachedContext.type || "file"})]
${attachedContext.content ? attachedContext.content.slice(0, 4000) : ""}

`;
        finalPrompt = `${prefix}${trimmed}`;
      }
    }

    setInput("");
    baseTextRef.current = "";
    setAttachedContext(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "28px";
    }

    if (onSendPrompt) {
      if (attachments.length > 0) {
        onSendPrompt(finalPrompt, attachments);
      } else {
        onSendPrompt(finalPrompt);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isText =
      file.type.startsWith('text/') ||
      file.name.match(/\.(md|txt|json|csv|js|ts|jsx|tsx|py|html|css|yaml|yml|sql|sh|env)$/i);

    if (isText) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedContext({
          name: file.name,
          type: 'file',
          mimeType: file.type || 'text/plain',
          content: event.target.result || '',
        });
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result || '';
        const mimeType =
          file.type ||
          (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');

        const type = file.type.startsWith('image/')
          ? 'image'
          : file.type.startsWith('audio/')
            ? 'audio'
            : file.type.startsWith('video/')
              ? 'video'
              : file.name.toLowerCase().endsWith('.pdf') || file.type.includes('pdf')
                ? 'pdf'
                : 'file';

        setAttachedContext({
          name: file.name,
          type,
          mimeType,
          data: dataUrl,
          size: file.size,
        });
      };
      reader.readAsDataURL(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectChip = (promptText) => {
    if (isStreaming) return;
    if (onSendPrompt) {
      onSendPrompt(promptText);
    } else {
      setInput(promptText);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const hasContent = Boolean(input.trim() || attachedContext);

  return (
    <div className={styles.heroContainer} data-testid="chat-hero">
      <div className={styles.heroContent}>
        {/* Context-Aware Gemini-inspired Hero Headline */}
        <div className={styles.greetingHeader}>
          <div className={styles.sparkleIcon}>
            <img src={logoImg} alt="NexAI Logo" className={styles.heroLogoImg} />
          </div>
          <h1 className={styles.heroHeadline}>{greeting.headline}</h1>
          <p className={styles.heroSubtitle}>{greeting.subtitle}</p>
        </div>

        {/* Modern Responsive Prompt Composer Card */}
        <div className={styles.composerCard}>
          <form onSubmit={handleSubmit} className={styles.composerForm}>
            {/* Attached media & context preview */}
            {attachedContext && (
              <AttachedContextPreview
                context={attachedContext}
                onRemove={() => setAttachedContext(null)}
              />
            )}

            {/* Hidden File Input for Attachments */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              aria-label="Attach file"
              accept="image/*,audio/*,video/*,.pdf,.txt,.md,.markdown,.json,.csv,.js,.ts,.jsx,.tsx,.py,.html,.css,.yaml,.yml,.sql"
            />

            {/* Full-width Responsive Prompt Textarea */}
            <div className={styles.inputWrapper}>
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  baseTextRef.current = e.target.value;
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  isSimulation
                    ? 'Simulation Mode (0 tokens) — Ask anything...'
                    : 'Ask NexAI anything...'
                }
                className={styles.inputField}
                aria-label="Ask NexAI anything"
              />
            </div>

            {/* Bottom Actions Toolbar: Attach on left, Tools & Submit on right */}
            <div className={styles.bottomToolbar}>
              <div className={styles.leftActions}>
                <IconButton
                  type="button"
                  icon={<Plus size={18} />}
                  label="Attach context file or library"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAttachModalOpen(true)}
                  className={styles.attachBtn}
                />
              </div>

              <div className={styles.rightActions}>
                <button
                  type="button"
                  onClick={toggleSimulation}
                  className={cn(styles.simPill, isSimulation && styles.activeSimPill)}
                  title={
                    isSimulation
                      ? 'Simulation mode active (0 tokens consumed)'
                      : 'Switch to zero-token simulation mode'
                  }
                  aria-label={
                    isSimulation
                      ? 'Disable zero-token simulation mode'
                      : 'Enable zero-token simulation mode'
                  }
                >
                  <Zap size={13} className={isSimulation ? styles.activeZap : undefined} />
                  <span className={styles.simText}>{isSimulation ? 'Sim (0 Tokens)' : 'Sim'}</span>
                </button>

                <button
                  type="button"
                  className={cn(
                    styles.thinkingPill,
                    thinkingLevel !== 'off' && styles.activeThinkingPill,
                  )}
                  onClick={handleCycleThinking}
                  disabled={isStreaming}
                  title={`Gemini Reasoning: ${thinkingLevel.toUpperCase()}. Click to cycle (Off, Low, Medium, High)`}
                  aria-label={`Toggle thinking level, current is ${thinkingLevel}`}
                >
                  <Brain
                    size={13}
                    className={thinkingLevel !== 'off' ? styles.activeBrain : undefined}
                  />
                  <span className={styles.thinkingText}>
                    {thinkingLevel === 'off'
                      ? 'Think: Off'
                      : `Think: ${thinkingLevel.charAt(0).toUpperCase() + thinkingLevel.slice(1)}`}
                  </span>
                </button>

                <IconButton
                  type="button"
                  icon={<Terminal size={15} />}
                  label="Use prompt template"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsPickerOpen(true)}
                  className={styles.toolBtn}
                />

                <IconButton
                  type="button"
                  icon={
                    isListening ? (
                      <span className={styles.recordingIconWrapper}>
                        <Mic size={16} className={styles.activeMicIcon} />
                        <span className={styles.recordingRing} aria-hidden="true" />
                      </span>
                    ) : (
                      <Mic size={16} />
                    )
                  }
                  label={
                    !isVoiceSupported
                      ? 'Voice input not supported in this browser'
                      : isListening
                        ? 'Listening... Click to stop dictation'
                        : 'Voice dictation'
                  }
                  disabled={!isVoiceSupported}
                  variant={isListening ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={handleToggleListening}
                  className={cn(styles.toolBtn, isListening && styles.listeningMic)}
                />

                {hasContent && (
                  <IconButton
                    type="submit"
                    icon={<ArrowUp size={16} />}
                    label="Send prompt"
                    variant="primary"
                    size="sm"
                    disabled={!hasContent}
                    className={styles.sendBtn}
                  />
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Minimalist Gemini Quick Prompts (clean text rows, not cards) */}
        <div className={styles.quickPromptsList} aria-label="Suggested starter prompts">
          {STARTER_PROMPTS.map((item, index) => (
            <button
              key={index}
              type="button"
              className={styles.quickPromptRow}
              onClick={() => handleSelectChip(item.prompt)}
              aria-label={item.title}
            >
              <span className={styles.promptIcon}>{item.icon}</span>
              <span className={styles.promptText}>{item.prompt}</span>
              <span className={styles.promptCategory}>{item.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Attach Context from Library or Device Modal */}
      <AttachContextModal
        open={isAttachModalOpen}
        onClose={() => setIsAttachModalOpen(false)}
        onSelect={(item) => setAttachedContext(item)}
        onUploadLocal={() => fileInputRef.current?.click()}
      />

      {/* Prompt Selector Modal */}
      <PromptPickerModal
        open={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelectPrompt={handleSelectPrompt}
      />

      {/* Variable Fill Modal */}
      {selectedPromptForVariables && (
        <VariableFillModal
          open={Boolean(selectedPromptForVariables)}
          onClose={() => setSelectedPromptForVariables(null)}
          prompt={selectedPromptForVariables}
          onConfirm={insertCompiledPrompt}
          actionLabel="Use in Chat"
        />
      )}
    </div>
  );
}

ChatHero.propTypes = {
  onSendPrompt: PropTypes.func,
  initialPrompt: PropTypes.string,
  onClearInitialPrompt: PropTypes.func,
};


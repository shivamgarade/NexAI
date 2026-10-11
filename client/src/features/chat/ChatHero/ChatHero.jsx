import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Plus,
  Mic,
  ArrowUp,
  HelpCircle,
  Code2,
  Mail,
  Server,
  ChevronDown,
  Upload,
} from 'lucide-react';
import { AttachContextPopover } from '../ChatInput/AttachContextPopover';
import { AttachedContextPreview } from '../ChatInput/AttachedContextPreview';
import { PromptPickerModal, VariableFillModal } from '@/features/prompts';
import { ModelSelectorPopover } from '../ModelSelector';
import { useChatStore, AVAILABLE_MODELS, MORE_MODELS } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { libraryApi } from '@/lib/api/library.api';
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
    selectedModel,
    thinkingLevel,
  } = useChatStore();

  const [isModelPopoverOpen, setIsModelPopoverOpen] = useState(false);
  const modelButtonRef = useRef(null);
  const attachButtonRef = useRef(null);

  const currentModelObj =
    AVAILABLE_MODELS.find((m) => m.id === selectedModel) ||
    MORE_MODELS.find((m) => m.id === selectedModel);
  const modelShortName = currentModelObj
    ? currentModelObj.name.replace('NexAI 2.5 ', '')
    : 'Flash';
  const effortName = thinkingLevel ? thinkingLevel.charAt(0).toUpperCase() + thinkingLevel.slice(1) : 'Medium';
  const modelPillLabel = `${modelShortName} ${effortName}`;

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
      const minH = 52;
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
      textareaRef.current.style.height = "52px";
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

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  const processAndAttachFile = (file) => {
    if (!file) return;

    const isText =
      file.type.startsWith('text/') ||
      file.name.match(/\.(md|txt|json|csv|js|ts|jsx|tsx|py|html|css|yaml|yml|sql|sh|env)$/i);

    const isImage = file.type.startsWith('image/');
    const type = isImage
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
      mimeType: file.type || (isText ? 'text/plain' : 'application/octet-stream'),
      size: file.size,
      isUploading: true,
      progress: 45,
    });

    if (isText) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result || '';
        setAttachedContext({
          name: file.name,
          type: 'file',
          mimeType: file.type || 'text/plain',
          content,
          size: file.size,
          isUploading: false,
        });

        // Persist note to user library in background
        libraryApi
          .createItem({
            title: file.name,
            type: 'note',
            content,
            category: 'general',
          })
          .catch(() => {});
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result || '';
        setAttachedContext({
          name: file.name,
          type,
          mimeType:
            file.type ||
            (file.name.toLowerCase().endsWith('.pdf')
              ? 'application/pdf'
              : 'application/octet-stream'),
          data: dataUrl,
          size: file.size,
          isUploading: false,
        });

        // Persist media/file to user library in background
        libraryApi
          .createItem({
            title: file.name,
            type: 'file',
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            fileData: dataUrl,
            category: 'general',
          })
          .catch(() => {});
      };
      reader.readAsDataURL(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndAttachFile(file);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDraggingOver(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processAndAttachFile(files[0]);
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

        {/* Modern Responsive Prompt Composer Card (Claude-inspired spacious layout) */}
        <div
          className={cn(styles.composerCard, isDraggingOver && styles.composerCardDragging)}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {isDraggingOver && (
            <div className={styles.composerDragOverlay}>
              <div className={styles.composerDragContent}>
                <Upload size={22} className={styles.composerDragIcon} />
                <span>Drop files here to attach</span>
              </div>
            </div>
          )}
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

            {/* Top Textarea Area */}
            <div className={styles.inputArea}>
              <textarea
                ref={textareaRef}
                rows={2}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  baseTextRef.current = e.target.value;
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  isSimulation
                    ? 'Simulation Mode (0 tokens) — How can I help you today?'
                    : 'How can I help you today?'
                }
                className={styles.inputField}
                aria-label="Ask NexAI anything"
              />
            </div>

            {/* Bottom Actions Toolbar: Attach (+) on left; Model Selector, Mic, Send on right */}
            <div className={styles.composerBottomRow}>
              <div className={styles.bottomLeftActions}>
                <div className={styles.attachAnchorWrapper}>
                  <button
                    ref={attachButtonRef}
                    type="button"
                    className={cn(styles.attachBtn, isAttachModalOpen && styles.attachBtnActive)}
                    onClick={() => setIsAttachModalOpen((prev) => !prev)}
                    title="Attach context file or prompt"
                    aria-label="Attach context file"
                  >
                    <Plus size={18} />
                  </button>

                  <AttachContextPopover
                    open={isAttachModalOpen}
                    onClose={() => setIsAttachModalOpen(false)}
                    anchorRef={attachButtonRef}
                    onSelect={(item) => setAttachedContext(item)}
                    onUploadLocal={() => fileInputRef.current?.click()}
                  />
                </div>
              </div>

              <div className={styles.bottomRightActions}>
                <div className={styles.popoverAnchorWrapper}>
                  <button
                    ref={modelButtonRef}
                    type="button"
                    className={styles.modelPillLink}
                    onClick={() => setIsModelPopoverOpen((prev) => !prev)}
                    disabled={isStreaming}
                    title={`AI Model: ${modelShortName} · Effort: ${effortName}`}
                    aria-label="Select AI model and effort"
                  >
                    <span className={styles.modelText}>{modelPillLabel}</span>
                    <ChevronDown size={13} className={styles.modelChevron} />
                  </button>

                  <ModelSelectorPopover
                    open={isModelPopoverOpen}
                    onClose={() => setIsModelPopoverOpen(false)}
                    anchorRef={modelButtonRef}
                  />
                </div>

                <button
                  type="button"
                  className={cn(styles.micBtn, isListening && styles.listeningMic)}
                  onClick={handleToggleListening}
                  disabled={!isVoiceSupported}
                  title={
                    !isVoiceSupported
                      ? 'Voice input not supported in this browser'
                      : isListening
                        ? 'Listening... Click to stop dictation'
                        : 'Voice dictation'
                  }
                  aria-label={
                    !isVoiceSupported
                      ? 'Voice input not supported in this browser'
                      : isListening
                        ? 'Listening... Click to stop dictation'
                        : 'Voice dictation'
                  }
                >
                  <Mic size={17} />
                </button>

                {hasContent && (
                  <button
                    type="submit"
                    className={styles.sendBtn}
                    title="Send prompt (Enter)"
                    aria-label="Send prompt"
                  >
                    <ArrowUp size={16} />
                  </button>
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

        {/* Clean Centered Disclaimer below quick prompts, outside the input card */}
        <p className={styles.disclaimerText}>
          NexAI is an AI workspace and can make mistakes. Please double-check responses.
        </p>
      </div>


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


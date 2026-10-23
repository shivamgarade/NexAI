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
  Upload,
  MessageSquareDashed,
  Zap,
  X,
} from 'lucide-react';
import { AttachContextPopover } from '../ChatInput/AttachContextPopover';
import { AttachedContextPreview } from '../ChatInput/AttachedContextPreview';
import { SlashSkillsPopover, VariableFillModal } from '@/features/skills';
import { useChatStore } from '@/store/chatStore';
import { useSkillStore } from '@/store/skillStore';
import { useAuthStore } from '@/store/authStore';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { libraryApi } from '@/lib/api/library.api';
import { toast } from '@/store/uiStore';
import { getGreetingContext } from './greetingHelper';
import { cn } from '@/lib/utils/cn';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { useSchemaStore } from '@/store/schemaStore';
import { matchSchemaIntent } from '@/features/schemaDesigner';
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
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const greeting = getGreetingContext(user);

  const {
    isStreaming,
    isSimulation,
    isTemporaryChat,
    startTemporaryChat,
    clearTemporaryChat,
  } = useChatStore();

  const attachButtonRef = useRef(null);

  const [input, setInput] = useState('');
  const [attachedContext, setAttachedContext] = useState(null);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [isSlashOpen, setIsSlashOpen] = useState(false);
  const { activeSkill, setActiveSkill, clearActiveSkill } = useSkillStore();
  const [selectedSkillForVariables, setSelectedSkillForVariables] = useState(null);
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

  const handleSelectSkill = (skill) => {
    setIsSlashOpen(false);
    if (input.startsWith('/')) {
      setInput('');
      baseTextRef.current = '';
    }
    if (skill.variables && skill.variables.length > 0) {
      setSelectedSkillForVariables(skill);
    } else {
      setActiveSkill(skill);
      toast.info(`Active Skill: ${skill.title}`);
    }
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleConfirmSkillVariables = (compiledInstructions) => {
    if (selectedSkillForVariables) {
      setActiveSkill({
        ...selectedSkillForVariables,
        instructions: compiledInstructions,
      });
      toast.info(`Active Skill: ${selectedSkillForVariables.title}`);
    }
    setSelectedSkillForVariables(null);
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

  // Adjust textarea height dynamically with smooth auto-grow up to 200px (no scrollbar until max height)
  useEffect(() => {
    if (textareaRef.current) {
      if (!input) {
        textareaRef.current.style.height = '32px';
        textareaRef.current.style.overflowY = 'hidden';
        return;
      }
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      const minH = 32;
      const maxH = 200;
      if (scrollH > maxH) {
        textareaRef.current.style.overflowY = 'auto';
        textareaRef.current.style.height = `${maxH}px`;
      } else {
        textareaRef.current.style.overflowY = 'hidden';
        textareaRef.current.style.height = `${Math.max(scrollH, minH)}px`;
      }
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
          type: attachedContext.type,
        });
        if (!finalPrompt) {
          finalPrompt = `[Analyzed ${attachedContext.type || "file"}: ${attachedContext.name}]`;
        }
      } else {
        const prefix = `[Attached Context: ${attachedContext.name} (${attachedContext.type || "file"})]
${attachedContext.content ? attachedContext.content.slice(0, 4000) : ""}

`;
        finalPrompt = `${prefix}${trimmed}`;
        attachments.push({
          name: attachedContext.name,
          mimeType: attachedContext.mimeType || "text/plain",
          size: attachedContext.size || 0,
          type: attachedContext.type || "file",
          content: attachedContext.content,
        });
      }
    }

    setInput("");
    baseTextRef.current = "";
    setAttachedContext(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "32px";
      textareaRef.current.style.overflowY = "hidden";
    }

    // Check for Data Modeling / ER Diagram intent
    const schemaMatch = matchSchemaIntent(trimmed, activeSkill);
    if (schemaMatch.isMatch) {
      setInput("");
      baseTextRef.current = "";
      setAttachedContext(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = "32px";
        textareaRef.current.style.overflowY = "hidden";
      }
      toast.info("Opening ER Diagram studio...");
      useSchemaStore.getState().setPrompt(schemaMatch.cleanPrompt);
      useSchemaStore.getState().generateSchema(schemaMatch.cleanPrompt);
      navigate(ROUTES.SCHEMA);
      return;
    }

    if (onSendPrompt) {
      if (attachments.length > 0) {
        onSendPrompt(finalPrompt, attachments);
      } else {
        onSendPrompt(finalPrompt);
      }
    }
  };

  const slashPopoverRef = useRef(null);
  const isSkillsPanelOpen = isSlashOpen || input.startsWith('/');
  const slashQuery = input.startsWith('/') ? input.slice(1) : '';

  const handleKeyDown = (e) => {
    if (isSkillsPanelOpen && slashPopoverRef.current?.handleKeyDown?.(e)) {
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape' && isSkillsPanelOpen) {
      e.preventDefault();
      setIsSlashOpen(false);
      if (input.startsWith('/')) {
        setInput('');
        baseTextRef.current = '';
      }
    }
  };

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  const processAndAttachFile = (file) => {
    if (!file) return;

    const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB limit
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error(
        `File "${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 10 MB.`,
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

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
    const schemaMatch = matchSchemaIntent(promptText, activeSkill);
    if (schemaMatch.isMatch) {
      toast.info("Opening ER Diagram studio...");
      useSchemaStore.getState().setPrompt(schemaMatch.cleanPrompt);
      useSchemaStore.getState().generateSchema(schemaMatch.cleanPrompt);
      navigate(ROUTES.SCHEMA);
      return;
    }

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

          <div className={styles.tempModeBar}>
            {isTemporaryChat ? (
              <div className={styles.tempActiveBanner}>
                <MessageSquareDashed size={14} className={styles.tempActiveIcon} />
                <span>Temporary Chat active (not saved to history)</span>
                <button
                  type="button"
                  className={styles.exitTempPillBtn}
                  onClick={clearTemporaryChat}
                  title="Switch back to regular chat"
                >
                  Exit
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={styles.tempToggleBtn}
                onClick={startTemporaryChat}
                title="Start a temporary chat that will not be saved"
              >
                <MessageSquareDashed size={14} />
                <span>Temporary chat</span>
              </button>
            )}
          </div>
        </div>

        {/* Modern Responsive Prompt Composer Card (Claude-inspired spacious layout) */}
        <div
          className={cn(
            styles.composerCard,
            isDraggingOver && styles.composerCardDragging,
            isTemporaryChat && styles.composerCardTemporary,
            isSkillsPanelOpen && styles.composerCardWithSkills,
          )}
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

            {/* Active Tool-Enabled Skill Badge */}
            {activeSkill && (
              <div className={styles.activeSkillPill}>
                <div className={styles.activeSkillIconWrapper}>
                  <Zap size={12} className={styles.activeSkillIcon} />
                </div>
                <div className={styles.activeSkillInfo}>
                  <span className={styles.activeSkillBadge}>Skill</span>
                  <span className={styles.activeSkillName}>{activeSkill.title}</span>
                </div>
                {activeSkill.tools && activeSkill.tools.length > 0 && (
                  <div className={styles.activeSkillToolsList}>
                    {activeSkill.tools.map((tool) => (
                      <span key={tool} className={styles.activeSkillToolTag}>
                        {tool}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className={styles.activeSkillRemoveBtn}
                  onClick={clearActiveSkill}
                  title="Remove active skill"
                  aria-label="Remove active skill"
                >
                  <X size={12} />
                </button>
              </div>
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

            {/* Slash Skills Popover — Compact, hierarchical, positioned above composer */}
            <SlashSkillsPopover
              ref={slashPopoverRef}
              open={isSkillsPanelOpen}
              onClose={() => {
                setIsSlashOpen(false);
                if (input.startsWith('/')) {
                  setInput('');
                  baseTextRef.current = '';
                }
              }}
              onSelectSkill={handleSelectSkill}
              searchQuery={slashQuery}
            />

            {/* Compact single-row capsule input (matching ChatInput and Gemini) */}
            <div className={styles.composerInputRow}>
              <div className={styles.attachAnchorWrapper}>
                <button
                  ref={attachButtonRef}
                  type="button"
                  className={cn(styles.attachBtn, isAttachModalOpen && styles.attachBtnActive)}
                  onClick={() => setIsAttachModalOpen((prev) => !prev)}
                  title="Attach context file"
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

              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  const val = e.target.value;
                  setInput(val);
                  baseTextRef.current = val;
                  if (val.startsWith('/')) {
                    setIsSlashOpen(true);
                  } else {
                    setIsSlashOpen(false);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  activeSkill
                    ? `Ask ${activeSkill.title}...`
                    : isSimulation
                      ? 'Ask NexAI (Simulation)...'
                      : 'Ask NexAI...'
                }
                className={styles.inputField}
                aria-label="Ask NexAI anything"
              />

              <div className={styles.inlineActions}>
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

        {/* Minimalist Gemini Quick Prompts (hidden in temporary chat for a clean focused layout) */}
        {!isTemporaryChat && (
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
        )}

        {/* Clean Centered Disclaimer below quick prompts, outside the input card */}
        <p className={styles.disclaimerText}>
          NexAI is an AI workspace and can make mistakes. Please double-check responses.
        </p>
      </div>



      {/* Variable Fill Modal for Skill */}
      {selectedSkillForVariables && (
        <VariableFillModal
          open={Boolean(selectedSkillForVariables)}
          onClose={() => setSelectedSkillForVariables(null)}
          skill={selectedSkillForVariables}
          onConfirm={handleConfirmSkillVariables}
          actionLabel="Activate Skill"
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


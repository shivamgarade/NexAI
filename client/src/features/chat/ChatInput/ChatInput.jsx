import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  ArrowUp,
  Square,
  Zap,
  Brain,
  Mic,
  MicOff,
  Paperclip,
  Terminal,
  Cpu,
  ChevronDown,
  Plus,
  CornerDownLeft,
  Upload,
  X,
} from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { SlashSkillsPopover, VariableFillModal } from '@/features/skills';
import { ModelSelectorPopover } from '../ModelSelector';
import { AttachContextPopover } from './AttachContextPopover';
import { AttachedContextPreview } from './AttachedContextPreview';
import { useChatStore, AVAILABLE_MODELS, MORE_MODELS } from '@/store/chatStore';
import { useSkillStore } from '@/store/skillStore';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { libraryApi } from '@/lib/api/library.api';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { useSchemaStore } from '@/store/schemaStore';
import { matchSchemaIntent } from '@/features/schemaDesigner';
import { toast } from '@/store/uiStore';
import { cn } from '@/lib/utils/cn';
import styles from './ChatInput.module.scss';

export function ChatInput({ prefillValue, onClearPrefill }) {
  const navigate = useNavigate();
  const {
    sendMessage,
    isStreaming,
    stopGeneration,
    isSimulation,
    toggleSimulation,
    selectedModel,
    thinkingLevel,
    setThinkingLevel,
    isTemporaryChat,
  } = useChatStore();

  const [isModelPopoverOpen, setIsModelPopoverOpen] = useState(false);
  const modelButtonRef = useRef(null);

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
  const [isSlashOpen, setIsSlashOpen] = useState(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [selectedPromptForVariables, setSelectedPromptForVariables] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachButtonRef = useRef(null);

  const hasContent = Boolean(input.trim() || attachedContext);

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

  const { activeSkill, setActiveSkill, clearActiveSkill } = useSkillStore();
  const [selectedSkillForVariables, setSelectedSkillForVariables] = useState(null);

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

  // Handle external prefill (e.g. from prompt vault or suggestion chips)
  useEffect(() => {
    if (prefillValue) {
      setInput(prefillValue);
      baseTextRef.current = prefillValue;
      onClearPrefill?.();
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [prefillValue, onClearPrefill]);

  // Adjust height of textarea dynamically
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, 28), 220);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (isListening) {
      stopListening();
    }
    const trimmed = input.trim();
    if ((!trimmed && !attachedContext) || isStreaming) {
      return;
    }

    let messageToSend = trimmed;
    const attachments = [];

    if (attachedContext) {
      if (attachedContext.data) {
        attachments.push({
          name: attachedContext.name,
          mimeType: attachedContext.mimeType || 'application/octet-stream',
          data: attachedContext.data,
          size: attachedContext.size || 0,
          type: attachedContext.type,
        });
        if (!messageToSend) {
          messageToSend = `[Analyzed ${attachedContext.type || 'file'}: ${attachedContext.name}]`;
        }
      } else {
        const contextPrefix = `[Attached Context: ${attachedContext.name} (${attachedContext.type || 'file'})]\n${attachedContext.content ? attachedContext.content.slice(0, 4000) : ''}\n[End of Context]\n\n`;
        messageToSend = `${contextPrefix}${trimmed}`;
        attachments.push({
          name: attachedContext.name,
          mimeType: attachedContext.mimeType || 'text/plain',
          size: attachedContext.size || 0,
          type: attachedContext.type || 'file',
          content: attachedContext.content,
        });
      }
    }

    setInput('');
    baseTextRef.current = '';
    setAttachedContext(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = '28px';
    }

    // Check for Data Modeling / ER Diagram intent
    const schemaMatch = matchSchemaIntent(trimmed, activeSkill);
    if (schemaMatch.isMatch) {
      toast.info('Opening ER Diagram studio...');
      useSchemaStore.getState().setPrompt(schemaMatch.cleanPrompt);
      useSchemaStore.getState().generateSchema(schemaMatch.cleanPrompt);
      navigate(ROUTES.SCHEMA);
      return;
    }

    await sendMessage(messageToSend, attachments, { skill: activeSkill });
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

  return (
    <div className={styles.inputContainer}>
      <form
        className={cn(
          styles.composerForm,
          isDraggingOver && styles.composerFormDragging,
          isTemporaryChat && styles.composerFormTemporary,
          isSkillsPanelOpen && styles.composerFormWithSkills,
        )}
        onSubmit={handleSubmit}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDraggingOver && (
          <div className={styles.composerDragOverlay}>
            <div className={styles.composerDragContent}>
              <Upload size={18} className={styles.composerDragIcon} />
              <span>Drop files here to attach</span>
            </div>
          </div>
        )}
        {/* Attached context / media preview */}
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

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          aria-label="Attach file"
          accept="image/*,audio/*,video/*,.pdf,.txt,.md,.markdown,.json,.csv,.js,.ts,.jsx,.tsx,.py,.html,.css,.yaml,.yml,.sql"
        />

        {/* Integrated Slash Skills Section — Part of input container */}
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

        <div className={styles.composerInputRow}>
          <div className={styles.attachAnchorWrapper}>
            <button
              ref={attachButtonRef}
              type="button"
              className={cn(styles.addBtn, isAttachModalOpen && styles.addBtnActive)}
              onClick={() => setIsAttachModalOpen((prev) => !prev)}
              title="Add attachment"
              aria-label="Add attachment"
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
            placeholder={activeSkill ? `Ask ${activeSkill.title}...` : 'Ask NexAI...'}
            className={styles.textarea}
            aria-label="Chat input message"
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
              aria-label="Voice input"
            >
              <Mic size={16} />
            </button>

            {isStreaming ? (
              <button
                type="button"
                onClick={stopGeneration}
                className={styles.stopBtn}
                title="Stop generating"
                aria-label="Stop generating"
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : hasContent ? (
              <button
                type="submit"
                className={styles.sendBtn}
                title="Send message (Enter)"
                aria-label="Send message"
              >
                <CornerDownLeft size={16} />
              </button>
            ) : null}
          </div>
        </div>
      </form>

      {/* Bottom Footer: Disclaimer on left, Model Selector on right */}
      <div className={styles.composerFooter}>
        <span className={styles.disclaimerText}>
          NexAI is an AI workspace and can make mistakes. Please double-check responses.
        </span>

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

ChatInput.propTypes = {
  prefillValue: PropTypes.string,
  onClearPrefill: PropTypes.func,
};

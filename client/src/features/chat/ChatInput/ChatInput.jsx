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
} from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { PromptPickerModal, VariableFillModal } from '@/features/prompts';
import { ModelSelectorPopover } from '../ModelSelector';
import { AttachContextPopover } from './AttachContextPopover';
import { AttachedContextPreview } from './AttachedContextPreview';
import { useChatStore, AVAILABLE_MODELS, MORE_MODELS } from '@/store/chatStore';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { libraryApi } from '@/lib/api/library.api';
import { cn } from '@/lib/utils/cn';
import styles from './ChatInput.module.scss';

export function ChatInput({ prefillValue, onClearPrefill }) {
  const {
    sendMessage,
    isStreaming,
    stopGeneration,
    isSimulation,
    toggleSimulation,
    selectedModel,
    thinkingLevel,
    setThinkingLevel,
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
  const [isPickerOpen, setIsPickerOpen] = useState(false);
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

  const handleSelectPrompt = (prompt) => {
    if (prompt.variables && prompt.variables.length > 0) {
      setSelectedPromptForVariables(prompt);
    } else {
      insertCompiledPrompt(prompt.template);
    }
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
    if (attachedContext) {
      const contextPrefix = `[Attached Context: ${attachedContext.name} (${attachedContext.type || 'file'})]\n${attachedContext.content ? attachedContext.content.slice(0, 4000) : ''}\n[End of Context]\n\n`;
      messageToSend = `${contextPrefix}${trimmed}`;
    }

    setInput('');
    baseTextRef.current = '';
    setAttachedContext(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = '28px';
    }
    await sendMessage(messageToSend);
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

  return (
    <div className={styles.inputContainer}>
      <form
        className={cn(styles.composerForm, isDraggingOver && styles.composerFormDragging)}
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

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          aria-label="Attach file"
          accept="image/*,audio/*,video/*,.pdf,.txt,.md,.markdown,.json,.csv,.js,.ts,.jsx,.tsx,.py,.html,.css,.yaml,.yml,.sql"
        />

        <div className={styles.composerInputRow}>
          <div className={styles.attachAnchorWrapper}>
            <button
              ref={attachButtonRef}
              type="button"
              className={cn(styles.addBtn, isAttachModalOpen && styles.addBtnActive)}
              onClick={() => setIsAttachModalOpen((prev) => !prev)}
              title="Add attachment or prompt template"
              aria-label="Add attachment or prompt"
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
              setInput(e.target.value);
              baseTextRef.current = e.target.value;
            }}
            onKeyDown={handleKeyDown}
            placeholder="Write a message..."
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
          actionLabel="Insert into Chat"
        />
      )}
    </div>
  );
}

ChatInput.propTypes = {
  prefillValue: PropTypes.string,
  onClearPrefill: PropTypes.func,
};

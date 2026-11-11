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
  AudioLines,
  Volume2,
} from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { SkillPickerModal, VariableFillModal } from '@/features/skills';
import { ModelSelectorPopover } from '../ModelSelector';
import { AttachContextPopover } from './AttachContextPopover';
import { AttachedContextPreview } from './AttachedContextPreview';
import { useChatStore, AVAILABLE_MODELS, MORE_MODELS } from '@/store/chatStore';
import { useSkillStore } from '@/store/skillStore';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { libraryApi } from '@/lib/api/library.api';
import { toast } from '@/store/uiStore';
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
    isTemporaryChat,
    isVoiceMode,
    isAiSpeaking,
    toggleVoiceMode,
    cancelAiSpeech,
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
  const [attachedContexts, setAttachedContexts] = useState([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [selectedPromptForVariables, setSelectedPromptForVariables] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachButtonRef = useRef(null);

  const hasContent = Boolean(input.trim() || attachedContexts.length > 0);

  const baseTextRef = useRef('');
  const latestInputRef = useRef('');
  const silenceTimerRef = useRef(null);
  const handleSubmitRef = useRef(null);

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
    if (input.startsWith('/') || input.startsWith('@')) {
      setInput('');
      baseTextRef.current = '';
    }
    if (skill.variables && skill.variables.length > 0) {
      setSelectedSkillForVariables(skill);
    } else {
      setActiveSkill(skill);
      toast.info(`Active Skill: ${skill.title}`);
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

  // Web Speech API Voice Dictation Hook with Real-Time Streaming & Hands-Free Auto-Send
  const { isSupported: isVoiceSupported, isListening, startListening, stopListening, toggleListening } = useSpeechRecognition({
    continuous: true,
    onInterim: (interim) => {
      const base = baseTextRef.current;
      const currentVal = interim ? (base ? `${base} ${interim}` : interim) : base;
      setInput(currentVal);
      latestInputRef.current = currentVal;
      if (textareaRef.current) {
        textareaRef.current.focus();
      }

      // Hands-Free Conversational Turn: Reset silence pause countdown on interim speech
      if (useChatStore.getState().isVoiceMode) {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = setTimeout(() => {
          const state = useChatStore.getState();
          if (state.isVoiceMode && !state.isStreaming && !state.isAiSpeaking) {
            const textToSubmit = latestInputRef.current?.trim();
            if (textToSubmit && textToSubmit.length >= 2) {
              stopListening();
              handleSubmitRef.current?.();
            }
          }
        }, 1400);
      }
    },
    onResult: (transcription) => {
      const base = baseTextRef.current;
      const updated = base ? `${base} ${transcription}` : transcription;
      baseTextRef.current = updated;
      setInput(updated);
      latestInputRef.current = updated;
      if (textareaRef.current) {
        textareaRef.current.focus();
      }

      // Hands-Free Conversational Turn: Reset silence pause countdown on final utterance chunk
      if (useChatStore.getState().isVoiceMode) {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = setTimeout(() => {
          const state = useChatStore.getState();
          if (state.isVoiceMode && !state.isStreaming && !state.isAiSpeaking) {
            const textToSubmit = latestInputRef.current?.trim();
            if (textToSubmit && textToSubmit.length >= 2) {
              stopListening();
              handleSubmitRef.current?.();
            }
          }
        }, 1400);
      }
    },
  });

  // Hands-Free Conversational Loop: Automatically re-arm microphone when AI completes speaking
  useEffect(() => {
    let armTimer;
    if (isVoiceMode) {
      if (!isStreaming && !isAiSpeaking && !isListening) {
        armTimer = setTimeout(() => {
          const state = useChatStore.getState();
          if (state.isVoiceMode && !state.isStreaming && !state.isAiSpeaking) {
            baseTextRef.current = '';
            startListening();
          }
        }, 350);
      } else if ((isStreaming || isAiSpeaking) && isListening) {
        // Mute mic while AI is replying or speaking aloud to avoid acoustic feedback
        stopListening();
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }
    } else {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }
    return () => {
      if (armTimer) clearTimeout(armTimer);
    };
  }, [isVoiceMode, isStreaming, isAiSpeaking, isListening, startListening, stopListening]);

  const handleToggleListening = () => {
    if (isAiSpeaking) {
      cancelAiSpeech();
    }
    if (isVoiceMode) {
      if (isListening) {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        stopListening();
      } else {
        baseTextRef.current = input;
        startListening();
      }
      return;
    }
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
      const newHeight = Math.min(Math.max(scrollHeight, 24), 220);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (isListening) {
      stopListening();
    }
    const trimmed = input.trim();
    if ((!trimmed && attachedContexts.length === 0) || isStreaming) {
      return;
    }

    let messageToSend = trimmed;
    const attachments = [];
    let contextPrefix = '';

    for (const ctx of attachedContexts) {
      if (ctx.data) {
        attachments.push({
          name: ctx.name,
          mimeType: ctx.mimeType || 'application/octet-stream',
          data: ctx.data,
          size: ctx.size || 0,
          type: ctx.type,
        });
      } else {
        contextPrefix += `[Attached Context: ${ctx.name} (${ctx.type || 'file'})]\n${ctx.content ? ctx.content.slice(0, 4000) : ''}\n[End of Context]\n\n`;
        attachments.push({
          name: ctx.name,
          mimeType: ctx.mimeType || 'text/plain',
          size: ctx.size || 0,
          type: ctx.type || 'file',
          content: ctx.content,
        });
      }
    }

    if (contextPrefix) {
      messageToSend = `${contextPrefix}${trimmed}`;
    } else if (!trimmed && attachments.length > 0) {
      messageToSend = `[Attached ${attachments.length} file(s): ${attachments.map((a) => a.name).join(', ')}]`;
    }

    setInput('');
    baseTextRef.current = '';
    latestInputRef.current = '';
    setAttachedContexts([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px';
    }
    await sendMessage(messageToSend, attachments, { skill: activeSkill });
  };

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  });

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (isPickerOpen) {
        return;
      }
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Backspace') {
      if (input === '/' || input === '@' || (input.startsWith('/') && input.length <= 1) || (input.startsWith('@') && input.length <= 1)) {
        setIsPickerOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsPickerOpen(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    baseTextRef.current = val;
    latestInputRef.current = val;

    if (val.startsWith('/') || val.startsWith('@')) {
      setIsPickerOpen(true);
    } else if (isPickerOpen && !val.includes('/') && !val.includes('@')) {
      setIsPickerOpen(false);
    }
  };

  const handleInputClick = () => {
    if (isPickerOpen) {
      setIsPickerOpen(false);
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

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const uploadingItem = {
      id: tempId,
      name: file.name,
      type,
      mimeType: file.type || (isText ? 'text/plain' : 'application/octet-stream'),
      size: file.size,
      isUploading: true,
      progress: 45,
    };

    setAttachedContexts((prev) => [...prev, uploadingItem]);

    if (isText) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result || '';
        setAttachedContexts((prev) =>
          prev.map((item) =>
            item.id === tempId
              ? {
                  ...item,
                  content,
                  isUploading: false,
                }
              : item
          )
        );

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
        setAttachedContexts((prev) =>
          prev.map((item) =>
            item.id === tempId
              ? {
                  ...item,
                  data: dataUrl,
                  mimeType:
                    file.type ||
                    (file.name.toLowerCase().endsWith('.pdf')
                      ? 'application/pdf'
                      : 'application/octet-stream'),
                  isUploading: false,
                }
              : item
          )
        );

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
    const files = Array.from(e.target.files || []);
    files.forEach((file) => processAndAttachFile(file));
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

    const files = Array.from(e.dataTransfer.files || []);
    files.forEach((file) => processAndAttachFile(file));
  };

  return (
    <div className={styles.inputContainer}>
      {isPickerOpen && (
        <SkillPickerModal
          open={isPickerOpen}
          inline
          query={input.startsWith('/') || input.startsWith('@') ? input.slice(1) : ''}
          onClose={() => setIsPickerOpen(false)}
          onSelectSkill={handleSelectSkill}
        />
      )}
      <form
        className={cn(
          styles.composerForm,
          isDraggingOver && styles.composerFormDragging,
          isTemporaryChat && styles.composerFormTemporary
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
        {attachedContexts.length > 0 && (
          <AttachedContextPreview
            contexts={attachedContexts}
            onRemove={(idx) =>
              setAttachedContexts((prev) => prev.filter((_, i) => i !== idx))
            }
          />
        )}

        {/* Active Tool-Enabled Skill Pill */}
        {activeSkill && (
          <div className={styles.activeSkillPill}>
            <Zap size={13} className={styles.activeSkillIcon} />
            <span className={styles.activeSkillName}>{activeSkill.title}</span>
            {activeSkill.tools && activeSkill.tools.length > 0 && (
              <span className={styles.activeSkillTools}>
                • {activeSkill.tools.join(', ')}
              </span>
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
          multiple
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
              title="Add attachment"
              aria-label="Add attachment"
            >
              <Plus size={18} />
            </button>

            <AttachContextPopover
              open={isAttachModalOpen}
              onClose={() => setIsAttachModalOpen(false)}
              anchorRef={attachButtonRef}
              onSelect={(item) => setAttachedContexts((prev) => [...prev, item])}
              onUploadLocal={() => fileInputRef.current?.click()}
              onOpenSkills={() => setIsPickerOpen(true)}
            />
          </div>

          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onClick={handleInputClick}
            onKeyDown={handleKeyDown}
            placeholder={activeSkill ? `Ask ${activeSkill.title}...` : "Write a message... ('/' for skills)"}
            className={styles.textarea}
            aria-label="Chat input message"
          />

          <div className={styles.inlineActions}>
            {/* Real-time Voice Conversation Toggle (ChatGPT / Claude / Gemini style) */}
            <button
              type="button"
              className={cn(
                styles.voiceModeBtn,
                isVoiceMode && styles.voiceModeActive,
                isAiSpeaking && styles.aiSpeaking
              )}
              onClick={() => {
                if (isAiSpeaking) {
                  cancelAiSpeech();
                } else if (isVoiceMode) {
                  if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = null;
                  }
                  stopListening();
                  cancelAiSpeech();
                  toggleVoiceMode();
                } else {
                  toggleVoiceMode();
                  baseTextRef.current = '';
                }
              }}
              title={
                isAiSpeaking
                  ? 'NexAI is speaking (Click to interrupt)'
                  : isVoiceMode
                    ? 'Hands-free Voice Conversation Active (Click to turn off)'
                    : 'Turn on Hands-Free Voice Conversation Mode'
              }
              aria-label="Toggle voice conversation mode"
            >
              {isAiSpeaking ? (
                <Volume2 size={16} className={styles.pulsingVoiceIcon} />
              ) : (
                <AudioLines size={16} />
              )}
            </button>

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
        <div className={styles.disclaimerGroup}>
          <span className={styles.disclaimerText}>
            NexAI is an AI workspace and can make mistakes. Please double-check responses.
          </span>
          {isVoiceMode && (
            <span className={cn(styles.voiceStatusPill, isAiSpeaking && styles.speakingPill)}>
              <span className={styles.voicePulseDot} />
              {isAiSpeaking
                ? 'NexAI Speaking (Edge Neural)...'
                : isStreaming
                  ? 'NexAI is replying...'
                  : isListening
                    ? 'Listening... (auto-send on pause)'
                    : 'Voice Conversation Ready'}
            </span>
          )}
        </div>

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

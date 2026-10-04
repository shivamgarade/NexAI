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
} from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { PromptPickerModal, VariableFillModal } from '@/features/prompts';
import { AttachContextModal } from './AttachContextModal';
import { AttachedContextPreview } from './AttachedContextPreview';
import { useChatStore } from '@/store/chatStore';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { cn } from '@/lib/utils/cn';
import styles from './ChatInput.module.scss';

export function ChatInput({ prefillValue, onClearPrefill }) {
  const {
    sendMessage,
    isStreaming,
    stopGeneration,
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
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [selectedPromptForVariables, setSelectedPromptForVariables] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const hasContent = Boolean(input.trim() || attachedContext);

  const insertCompiledPrompt = (compiledText) => {
    setInput((prev) => (prev ? `${prev}\n\n${compiledText}` : compiledText));
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

  // Web Speech API Voice Dictation Hook
  const { isSupported: isVoiceSupported, isListening, toggleListening } = useSpeechRecognition({
    onResult: (transcription) => {
      setInput((prev) => (prev ? `${prev} ${transcription}` : transcription));
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    },
  });

  // Handle external prefill (e.g. from prompt vault or suggestion chips)
  useEffect(() => {
    if (prefillValue) {
      setInput(prefillValue);
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

  return (
    <div className={styles.inputContainer}>
      <form className={styles.composerForm} onSubmit={handleSubmit}>
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

        <div className={styles.inputArea}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isSimulation
                ? 'Simulation (0 tokens) — Message NexAI...'
                : 'Message NexAI... (Enter to send, Shift + Enter for new line)'
            }
            className={styles.textarea}
            aria-label="Chat input message"
          />
        </div>

        <div className={styles.bottomToolbar}>
          <div className={styles.leftControls}>
            <IconButton
              type="button"
              icon={<Paperclip size={16} />}
              label="Attach context from file or library"
              variant="ghost"
              size="sm"
              onClick={() => setIsAttachModalOpen(true)}
              className={styles.toolBtn}
            />

            <button
              type="button"
              className={cn(styles.simPill, isSimulation && styles.activeSimPill)}
              onClick={toggleSimulation}
              disabled={isStreaming}
              title={
                isSimulation
                  ? 'Simulation Mode active (0 Gemini tokens consumed)'
                  : 'Enable Zero-Token Simulation Mode for testing'
              }
              aria-label="Toggle simulation mode"
            >
              <Zap size={13} className={isSimulation ? styles.activeZap : undefined} />
              <span className={styles.simText}>{isSimulation ? 'Sim (0)' : 'Sim'}</span>
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
          </div>

          <div className={styles.rightControls}>
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
                  <MicOff size={15} className={styles.activeMicIcon} />
                ) : (
                  <Mic size={15} />
                )
              }
              label={
                !isVoiceSupported
                  ? 'Voice input not supported in this browser'
                  : isListening
                    ? 'Stop listening'
                    : 'Voice dictation'
              }
              disabled={!isVoiceSupported}
              variant={isListening ? 'primary' : 'ghost'}
              size="sm"
              onClick={toggleListening}
              className={cn(styles.toolBtn, isListening && styles.listeningMic)}
            />

            {isStreaming ? (
              <IconButton
                icon={<Square size={14} fill="currentColor" />}
                label="Stop generating"
                variant="secondary"
                size="sm"
                onClick={stopGeneration}
                className={styles.stopButton}
              />
            ) : (
              hasContent && (
                <IconButton
                  type="submit"
                  icon={<ArrowUp size={16} />}
                  label="Send message"
                  variant="primary"
                  size="sm"
                  disabled={!hasContent}
                  className={styles.sendButton}
                />
              )
            )}
          </div>
        </div>
      </form>

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

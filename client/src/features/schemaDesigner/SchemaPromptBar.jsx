import { useState, useRef, useEffect } from 'react';
import { Sparkles, ArrowUp, Square, Cpu } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { useSchemaStore } from '@/store/schemaStore';
import styles from './SchemaPromptBar.module.scss';

export function SchemaPromptBar() {
  const {
    prompt,
    setPrompt,
    generateSchema,
    isLoading,
    selectedModel,
    setSelectedModel,
    model,
  } = useSchemaStore();

  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef(null);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput('');
    setPrompt(text);
    generateSchema(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasEntities = Boolean(model?.entities?.length);
  const placeholder = hasEntities
    ? 'Refine your ER diagram, add tables, or modify relationships…'
    : 'Describe your schema or ask for changes…';

  return (
    <div className={styles.dockedBarContainer}>
      <form className={styles.composerBox} onSubmit={handleSubmit}>
        <div className={styles.inputRow}>
          <div className={styles.sparkleIcon}>
            <Sparkles size={16} />
          </div>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className={styles.textarea}
            disabled={isLoading}
          />

          <div className={styles.actionsCluster}>
            {isFocused && (
              <span className={styles.shortcutHint}>
                {navigator.platform?.includes('Mac') ? '⌘+Enter' : 'Ctrl+Enter'}
              </span>
            )}

            {/* Model Pill */}
            <button
              type="button"
              className={styles.modelPill}
              onClick={() => setSelectedModel(selectedModel === 'flash' ? 'pro' : 'flash')}
              title="Toggle Gemini Flash / Gemini Pro"
            >
              <Cpu size={12} className={styles.iconAccent} />
              <span>{selectedModel === 'pro' ? 'Pro' : 'Flash'}</span>
            </button>

            {/* Send Button */}
            <IconButton
              type="submit"
              variant="primary"
              size="sm"
              aria-label="Send prompt"
              disabled={!input.trim() || isLoading}
              className={styles.sendButton}
              icon={isLoading ? <Square size={13} className={styles.spin} /> : <ArrowUp size={15} />}
            />
          </div>
        </div>
      </form>
    </div>
  );
}

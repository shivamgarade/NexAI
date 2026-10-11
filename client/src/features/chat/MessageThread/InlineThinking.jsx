import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ChevronRight, Brain, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/store/uiStore';
import { MarkdownRenderer } from '../MarkdownRenderer';
import styles from './InlineThinking.module.scss';

export function InlineThinking({
  thoughts = '',
  isThinking = false,
  isStreaming = false,
  defaultExpanded = false,
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || isThinking);
  const [copied, setCopied] = useState(false);
  const userManuallyToggledRef = useRef(false);
  const prevThinkingRef = useRef(isThinking);

  // Auto-expand when model is thinking, auto-collapse when thinking finishes
  useEffect(() => {
    if (isThinking && !prevThinkingRef.current) {
      if (!userManuallyToggledRef.current) {
        setIsExpanded(true);
      }
    } else if (!isThinking && prevThinkingRef.current) {
      if (!userManuallyToggledRef.current) {
        setIsExpanded(false);
      }
    }
    prevThinkingRef.current = isThinking;
  }, [isThinking]);

  const handleToggle = () => {
    userManuallyToggledRef.current = true;
    setIsExpanded((prev) => !prev);
  };

  const handleCopy = async (e) => {
    e.stopPropagation();
    if (!thoughts) return;
    try {
      await navigator.clipboard.writeText(thoughts);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Reasoning copied to clipboard');
    } catch {
      toast.error('Failed to copy reasoning');
    }
  };

  if (!thoughts && !isThinking) {
    return null;
  }

  return (
    <div className={styles.inlineThinkingContainer}>
      <div className={styles.thinkingHeaderRow}>
        <button
          type="button"
          className={styles.thinkingToggleBtn}
          onClick={handleToggle}
          aria-expanded={isExpanded}
          aria-label="Toggle thinking trace"
        >
          <ChevronRight
            size={14}
            className={cn(styles.chevronIcon, isExpanded && styles.chevronRotated)}
          />
          <Brain
            size={13}
            className={cn(styles.brainIcon, isThinking && styles.pulsingBrain)}
          />
          <span className={styles.label}>
            {isThinking ? 'Thinking...' : 'Thought for a few seconds'}
          </span>
        </button>

        {thoughts && (
          <button
            type="button"
            className={styles.copyBtn}
            onClick={handleCopy}
            title="Copy reasoning trace"
            aria-label="Copy reasoning trace"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        )}
      </div>

      {isExpanded && thoughts && (
        <div className={styles.thinkingBody} role="region" aria-label="Reasoning trace details">
          <div className={styles.thoughtContentWrapper}>
            <MarkdownRenderer
              content={thoughts}
              variant="thought"
              allowSaveSnippet={false}
              isStreaming={isStreaming}
            />
          </div>
        </div>
      )}
    </div>
  );
}

InlineThinking.propTypes = {
  thoughts: PropTypes.string,
  isThinking: PropTypes.bool,
  isStreaming: PropTypes.bool,
  defaultExpanded: PropTypes.bool,
};

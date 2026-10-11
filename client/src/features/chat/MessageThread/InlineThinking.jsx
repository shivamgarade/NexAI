import { useState } from 'react';
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
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
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
      <button
        type="button"
        className={styles.thinkingHeader}
        onClick={() => setIsExpanded((prev) => !prev)}
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

      {isExpanded && thoughts && (
        <div className={styles.thinkingBody} role="region" aria-label="Reasoning trace details">
          <div className={styles.bodyTopRow}>
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
          </div>
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

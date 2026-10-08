import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Sparkles, BookmarkPlus, ArrowUpRight, Copy, Check } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/store/uiStore';
import styles from './PromptBlock.module.scss';

export function PromptBlock({ template = '', isStreaming = false, onSavePrompt, onUsePrompt }) {
  const [copied, setCopied] = useState(false);

  // Extract {{variable}} placeholders in real time
  const detectedVariables = useMemo(() => {
    if (!template) return [];
    const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    const matches = [...template.matchAll(regex)];
    return [...new Set(matches.map((m) => m[1].trim()))];
  }, [template]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      toast.success('Prompt copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleSaveToVault = () => {
    const firstLine = template
      .trim()
      .split('\n')[0]
      .replace(/^[#*-]+\s*/, '')
      .slice(0, 80);
    const suggestedTitle = firstLine ? `AI Prompt: ${firstLine}` : 'AI Generated Prompt';

    if (onSavePrompt) {
      onSavePrompt({
        title: suggestedTitle,
        template,
        tags: ['ai-generated', ...detectedVariables.slice(0, 3)],
      });
    } else {
      handleCopy();
    }
  };

  const handleUse = () => {
    if (onUsePrompt) {
      onUsePrompt(template);
      toast.success('Prompt inserted into chat');
    }
  };

  // Render text with highlighted {{variable}} spans (clean tag in preview, full braces in data)
  const renderedContent = useMemo(() => {
    if (!template) return null;
    const parts = template.split(/(\{\{\s*[a-zA-Z0-9_]+\s*\}\})/g);
    return parts.map((part, idx) => {
      const match = part.match(/^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/);
      if (match) {
        return (
          <span
            key={idx}
            className={styles.variablePill}
            data-variable={match[1]}
            title={`Variable: ${match[1]}`}
          >
            {match[1]}
          </span>
        );
      }
      return part;
    });
  }, [template]);

  return (
    <div className={styles.container} data-testid="prompt-block">
      <div className={styles.header}>
        <div className={styles.leftGroup}>
          <div className={styles.badgeWrapper}>
            <Sparkles size={14} className={styles.promptIcon} />
            <span className={styles.badgeText}>Prompt Template</span>
          </div>

          {detectedVariables.length > 0 && (
            <Badge tone="accent" className={styles.variableCountBadge}>
              {detectedVariables.length} variable{detectedVariables.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        <div className={styles.actions}>
          {onSavePrompt && !isStreaming && (
            <Tooltip content="Save to Prompt Vault" side="top">
              <button
                type="button"
                onClick={handleSaveToVault}
                className={styles.actionBtn}
                aria-label="Save to Prompt Vault"
              >
                <BookmarkPlus size={14} />
                <span>Save to Vault</span>
              </button>
            </Tooltip>
          )}

          {onUsePrompt && !isStreaming && (
            <Tooltip content="Use in new chat" side="top">
              <button
                type="button"
                onClick={handleUse}
                className={styles.actionBtn}
                aria-label="Use in chat composer"
              >
                <ArrowUpRight size={14} />
                <span>Use in New Chat</span>
              </button>
            </Tooltip>
          )}

          <Tooltip content={copied ? 'Copied!' : 'Copy prompt'} side="top">
            <button
              type="button"
              onClick={handleCopy}
              className={styles.actionBtn}
              aria-label="Copy prompt"
            >
              {copied ? (
                <>
                  <Check size={14} className={styles.checkIcon} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </Tooltip>
        </div>
      </div>

      <pre className={styles.content}>
        <code>{renderedContent}</code>
      </pre>
    </div>
  );
}

PromptBlock.propTypes = {
  template: PropTypes.string,
  isStreaming: PropTypes.bool,
  onSavePrompt: PropTypes.func,
  onUsePrompt: PropTypes.func,
};

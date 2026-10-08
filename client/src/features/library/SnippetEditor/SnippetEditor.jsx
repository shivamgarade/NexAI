import { useState, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { Copy, Check, Edit3, Eye } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-scss';
import { toast } from '@/store/uiStore';
import { cn } from '@/lib/utils/cn';
import styles from './SnippetEditor.module.scss';

export function SnippetEditor({
  value = '',
  onChange,
  language = 'plaintext',
  minHeight = 220,
}) {
  const [mode, setMode] = useState('preview'); // 'preview' | 'edit'
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef(null);

  const normalizedLang = (language || 'plaintext').toLowerCase();
  const grammar =
    Prism.languages[normalizedLang] ||
    Prism.languages.typescript ||
    Prism.languages.javascript ||
    Prism.languages.clike;

  const highlightedCode = useMemo(() => {
    try {
      return Prism.highlight(value, grammar, normalizedLang);
    } catch {
      return value;
    }
  }, [value, grammar, normalizedLang]);

  const lineCount = (value || '').split('\n').length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextValue = `${value.substring(0, start)}  ${value.substring(end)}`;
      onChange?.(nextValue);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 2, start + 2);
      }, 0);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.langBadge}>{normalizedLang}</span>
          <div className={styles.modeToggle} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'preview'}
              className={cn(styles.toggleBtn, mode === 'preview' && styles.active)}
              onClick={() => setMode('preview')}
            >
              <Eye size={13} />
              <span>Preview</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'edit'}
              className={cn(styles.toggleBtn, mode === 'edit' && styles.active)}
              onClick={() => setMode('edit')}
            >
              <Edit3 size={13} />
              <span>Edit</span>
            </button>
          </div>
        </div>

        <div className={styles.headerRight}>
          <span className={styles.lineInfo}>
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
          <button
            type="button"
            className={styles.copyBtn}
            onClick={handleCopy}
            title="Copy code to clipboard"
          >
            {copied ? (
              <>
                <Check size={13} className={styles.checkIcon} />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className={styles.contentArea} style={{ minHeight }}>
        {mode === 'preview' ? (
          <pre className={styles.pre} style={{ minHeight }}>
            <code
              className={`language-${normalizedLang}`}
              dangerouslySetInnerHTML={{ __html: highlightedCode }}
            />
          </pre>
        ) : (
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste or write code here..."
            style={{ minHeight }}
            rows={10}
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
}

SnippetEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  language: PropTypes.string,
  minHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

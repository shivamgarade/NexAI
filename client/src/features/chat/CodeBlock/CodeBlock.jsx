import { useState } from 'react';
import PropTypes from 'prop-types';
import { Copy, Check, Bookmark, Code2 } from 'lucide-react';
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
import { useLibraryStore } from '@/store/libraryStore';
import { toast } from '@/store/uiStore';
import { Tooltip } from '@/components/ui/Tooltip';
import styles from './CodeBlock.module.scss';

export function CodeBlock({ language = 'plaintext', value = '', allowSaveSnippet = true }) {
  const [copied, setCopied] = useState(false);

  const normalizedLang = language.toLowerCase();
  const displayLang =
    language && language.toLowerCase() !== 'plaintext'
      ? language.charAt(0).toUpperCase() + language.slice(1)
      : 'Code';
  const grammar =
    Prism.languages[normalizedLang] || Prism.languages.javascript || Prism.languages.clike;

  let highlightedCode = '';
  try {
    highlightedCode = Prism.highlight(value, grammar, normalizedLang);
  } catch {
    highlightedCode = value;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleSaveSnippet = () => {
    const firstLine = value.trim().split('\n')[0].replace(/^[/#*-]+\s*/, '').slice(0, 40);
    const snippetTitle = `${(language || 'Code').toUpperCase()} Snippet: ${firstLine || 'Code'}`;
    useLibraryStore.getState().openAddModal({
      type: 'note',
      title: snippetTitle,
      content: `\`\`\`${language || 'plaintext'}\n${value}\n\`\`\``,
      tags: ['snippet', (language || 'code').toLowerCase().trim()],
      isSnippet: true,
      language: (language || 'plaintext').toLowerCase(),
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.languageBadge}>
          <Code2 size={14} className={styles.codeIcon} />
          <span className={styles.languageText}>{displayLang}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {allowSaveSnippet && (
            <Tooltip content="Save snippet to library" side="top">
              <button
                type="button"
                onClick={handleSaveSnippet}
                className={styles.copyButton}
                aria-label="Save snippet to library"
              >
                <Bookmark size={14} />
                <span>Save Snippet</span>
              </button>
            </Tooltip>
          )}
          <Tooltip content={copied ? 'Copied!' : 'Copy code'} side="top">
            <button
              type="button"
              onClick={handleCopy}
              className={styles.copyButton}
              aria-label="Copy code to clipboard"
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

      <pre className={styles.pre}>
        <code
          className={`language-${normalizedLang}`}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </pre>
    </div>
  );
}

CodeBlock.propTypes = {
  language: PropTypes.string,
  value: PropTypes.string.isRequired,
  allowSaveSnippet: PropTypes.bool,
};

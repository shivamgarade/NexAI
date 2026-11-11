import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Copy, Check, Bookmark, Code2 } from 'lucide-react';
import mermaid from 'mermaid';
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

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'inherit',
});

export function CodeBlock({ language = 'plaintext', value = '', allowSaveSnippet = true }) {
  const [copied, setCopied] = useState(false);
  const [mermaidSvg, setMermaidSvg] = useState('');
  const [mermaidError, setMermaidError] = useState(null);
  const mermaidRef = useRef(null);

  const normalizedLang = (language || 'plaintext').toLowerCase();
  const isMermaid = normalizedLang === 'mermaid';

  useEffect(() => {
    if (!isMermaid || !value.trim()) return;

    let isMounted = true;
    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(id, value.trim());
        if (isMounted) {
          setMermaidSvg(svg);
          setMermaidError(null);
        }
      } catch (err) {
        if (isMounted) {
          setMermaidError(err.message || 'Failed to render diagram');
          setMermaidSvg('');
        }
      }
    };

    renderDiagram();
    return () => {
      isMounted = false;
    };
  }, [isMermaid, value]);

  const displayLang =
    language && language.toLowerCase() !== 'plaintext'
      ? normalizedLang
      : 'code';
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
        <span className={styles.languageText}>{displayLang}</span>
        <div className={styles.actions}>
          {allowSaveSnippet && (
            <Tooltip content="Save snippet to library" side="top">
              <button
                type="button"
                onClick={handleSaveSnippet}
                className={styles.iconButton}
                aria-label="Save snippet to library"
              >
                <Bookmark size={14} />
              </button>
            </Tooltip>
          )}
          <Tooltip content={copied ? 'Copied!' : 'Copy code'} side="top">
            <button
              type="button"
              onClick={handleCopy}
              className={styles.iconButton}
              aria-label="Copy code to clipboard"
            >
              {copied ? (
                <Check size={14} className={styles.checkIcon} />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </Tooltip>
        </div>
      </div>

      {isMermaid ? (
        <div className={styles.mermaidContainer}>
          {mermaidError ? (
            <div className={styles.mermaidError}>
              <span>Diagram syntax note: {mermaidError}</span>
              <pre className={styles.pre}><code>{value}</code></pre>
            </div>
          ) : mermaidSvg ? (
            <div dangerouslySetInnerHTML={{ __html: mermaidSvg }} />
          ) : (
            <div className={styles.mermaidLoading}>Rendering diagram...</div>
          )}
        </div>
      ) : (
        <pre className={styles.pre}>
          <code
            className={`language-${normalizedLang}`}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </pre>
      )}
    </div>
  );
}

CodeBlock.propTypes = {
  language: PropTypes.string,
  value: PropTypes.string.isRequired,
  allowSaveSnippet: PropTypes.bool,
};

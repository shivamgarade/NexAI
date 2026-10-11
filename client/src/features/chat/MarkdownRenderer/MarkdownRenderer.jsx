import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock, FileTreeBlock } from '../CodeBlock';
import { MermaidBlock } from '../MermaidBlock';
import { PromptBlock } from '../PromptBlock';
import { normalizeTableMarkdown } from './tableNormalizer';
import { cn } from '@/lib/utils/cn';
import styles from './MarkdownRenderer.module.scss';

const REMARK_PLUGINS = [remarkGfm];

export const MarkdownRenderer = React.memo(function MarkdownRenderer({
  content = '',
  className = '',
  variant = 'default',
  isStreaming = false,
  allowSaveSnippet = true,
  onSavePrompt,
  onUsePrompt,
}) {
  const components = useMemo(
    () => ({
      pre({ children }) {
        // Render children directly so CodeBlock provides its own container
        return <>{children}</>;
      },
      code({ className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '');
        const stringContent = String(children);
        const isBlock = Boolean(match) || stringContent.includes('\n');

        if (isBlock) {
          const lang = (match ? match[1] : 'plaintext').toLowerCase();
          const codeVal = stringContent.replace(/\n$/, '');

          if (lang === 'mermaid') {
            return <MermaidBlock chart={codeVal} isStreaming={isStreaming} />;
          }

          if (lang === 'prompt') {
            return (
              <PromptBlock
                template={codeVal}
                isStreaming={isStreaming}
                onSavePrompt={onSavePrompt}
                onUsePrompt={onUsePrompt}
              />
            );
          }

          const isTreeStructure =
            ['tree', 'dir', 'directory', 'folder', 'files'].includes(lang) ||
            /([├──└──│]|\|--)/.test(codeVal);

          if (isTreeStructure) {
            return <FileTreeBlock value={codeVal} />;
          }

          return (
            <CodeBlock
              language={lang}
              value={codeVal}
              allowSaveSnippet={allowSaveSnippet}
            />
          );
        }

        return (
          <code className={styles.inlineCode} {...props}>
            {children}
          </code>
        );
      },
      a({ href, children, ...props }) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
            {...props}
          >
            {children}
          </a>
        );
      },
      table({ children, ...props }) {
        return (
          <div className={styles.tableWrapper}>
            <table className={styles.table} {...props}>
              {children}
            </table>
          </div>
        );
      },
    }),
    [isStreaming, allowSaveSnippet, onSavePrompt, onUsePrompt],
  );

  const normalizedContent = useMemo(() => normalizeTableMarkdown(content), [content]);

  if (!content) {
    return null;
  }

  return (
    <div
      className={cn(
        styles.markdownContent,
        variant === 'thought' && styles.thoughtVariant,
        className,
        isStreaming && styles.streamingContent,
      )}
    >
      <Markdown remarkPlugins={REMARK_PLUGINS} components={components}>
        {normalizedContent}
      </Markdown>
    </div>
  );
});

MarkdownRenderer.propTypes = {
  content: PropTypes.string,
  className: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'thought']),
  isStreaming: PropTypes.bool,
  allowSaveSnippet: PropTypes.bool,
  onSavePrompt: PropTypes.func,
  onUsePrompt: PropTypes.func,
};


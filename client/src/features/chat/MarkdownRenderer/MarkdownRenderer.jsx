import PropTypes from 'prop-types';
import Markdown from 'react-markdown';
import { CodeBlock } from '../CodeBlock';
import { MermaidBlock } from '../MermaidBlock';
import { cn } from '@/lib/utils/cn';
import styles from './MarkdownRenderer.module.scss';

export function MarkdownRenderer({ content = '', isStreaming = false }) {
  if (!content) {
    return null;
  }

  return (
    <div className={cn(styles.markdownContent, isStreaming && styles.streamingContent)}>
      <Markdown
        components={{
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

              return (
                <CodeBlock
                  language={lang}
                  value={codeVal}
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
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}

MarkdownRenderer.propTypes = {
  content: PropTypes.string,
  isStreaming: PropTypes.bool,
};

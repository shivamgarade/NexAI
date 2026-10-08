import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  Code,
  FileCode,
  List,
  ListOrdered,
  Quote,
  Link,
  CheckSquare,
  Eye,
  Edit3,
} from 'lucide-react';
import { MarkdownRenderer } from '@/features/chat/MarkdownRenderer';
import { cn } from '@/lib/utils/cn';
import styles from './NoteEditor.module.scss';

export function NoteEditor({
  value = '',
  onChange,
  placeholder = 'Write your notes with Markdown support...',
  minHeight = 220,
  autoFocus = false,
  readOnly = false,
  className = '',
  initialTab = 'write',
}) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'write' | 'preview'
  const textareaRef = useRef(null);

  // Helper to insert markdown tags around selection or at cursor
  const insertFormatting = (prefix, suffix = '', defaultText = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || defaultText;

    const before = value.substring(0, start);
    const after = value.substring(end);

    const replacement = `${prefix}${selectedText}${suffix}`;
    const nextValue = `${before}${replacement}${after}`;

    onChange?.(nextValue);

    // Reposition cursor and refocus
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + selectedText.length;
      textarea.setSelectionRange(start + prefix.length, newCursorPos);
    }, 0);
  };

  const handleKeyDown = (e) => {
    // Tab key indent
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
      return;
    }

    // Ctrl/Cmd + B for bold
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      insertFormatting('**', '**', 'bold text');
      return;
    }

    // Ctrl/Cmd + I for italic
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      insertFormatting('*', '*', 'italic text');
      return;
    }

    // Ctrl/Cmd + K for link
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      insertFormatting('[', '](https://)', 'link title');
      return;
    }
  };

  // Word, Character and Reading Time stats
  const cleanText = (value || '').trim();
  const charCount = (value || '').length;
  const wordCount = cleanText ? cleanText.split(/\s+/).filter(Boolean).length : 0;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className={cn(styles.editorContainer, className)}>
      <div className={styles.topBar}>
        <div className={styles.modeTabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'write'}
            className={cn(styles.modeTab, activeTab === 'write' && styles.active)}
            onClick={() => setActiveTab('write')}
          >
            <Edit3 size={13} />
            <span>Write</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'preview'}
            className={cn(styles.modeTab, activeTab === 'preview' && styles.active)}
            onClick={() => setActiveTab('preview')}
          >
            <Eye size={13} />
            <span>Preview</span>
          </button>
        </div>

        {activeTab === 'write' && !readOnly && (
            <div className={styles.toolbar} role="toolbar" aria-label="Markdown formatting">
              <div className={styles.toolbarGroup}>
                <button
                  type="button"
                  className={styles.toolBtn}
                  title="Bold (Ctrl+B)"
                  onClick={() => insertFormatting('**', '**', 'bold text')}
                >
                  <Bold size={14} />
                </button>
                <button
                  type="button"
                  className={styles.toolBtn}
                  title="Italic (Ctrl+I)"
                  onClick={() => insertFormatting('*', '*', 'italic text')}
                >
                  <Italic size={14} />
                </button>
              </div>

              <div className={styles.divider} />

              <div className={styles.toolbarGroup}>
                <button
                  type="button"
                  className={styles.toolBtn}
                  title="Heading 1"
                  onClick={() => insertFormatting('# ', '', 'Heading 1')}
                >
                  <Heading1 size={14} />
                </button>
                <button
                  type="button"
                  className={styles.toolBtn}
                  title="Heading 2"
                  onClick={() => insertFormatting('## ', '', 'Heading 2')}
                >
                  <Heading2 size={14} />
                </button>
                <button
                  type="button"
                  className={styles.toolBtn}
                  title="Heading 3"
                  onClick={() => insertFormatting('### ', '', 'Heading 3')}
                >
                  <Heading3 size={14} />
                </button>
              </div>

              <div className={styles.divider} />

              <div className={styles.toolbarGroup}>
                <button
                  type="button"
                  className={styles.toolBtn}
                  title="Inline Code"
                  onClick={() => insertFormatting('`', '`', 'code')}
                >
                  <Code size={14} />
                </button>
                <button
                  type="button"
                  className={styles.toolBtn}
                  title="Code Block"
                  onClick={() => insertFormatting('```\n', '\n```', 'code block')}
                >
                  <FileCode size={14} />
                </button>
              </div>

              <div className={styles.divider} />

              <div className={styles.toolbarGroup}>
                <button
                  type="button"
                  className={styles.toolBtn}
                  title="Bullet List"
                  onClick={() => insertFormatting('- ', '', 'List item')}
                >
                  <List size={14} />
                </button>
                <button
                  type="button"
                  className={styles.toolBtn}
                  title="Numbered List"
                  onClick={() => insertFormatting('1. ', '', 'Numbered item')}
                >
                  <ListOrdered size={14} />
                </button>
                <button
                  type="button"
                  className={styles.toolBtn}
                  title="Task Item"
                  onClick={() => insertFormatting('- [ ] ', '', 'Task')}
                >
                  <CheckSquare size={14} />
                </button>
                <button
                  type="button"
                  className={styles.toolBtn}
                  title="Blockquote"
                  onClick={() => insertFormatting('> ', '', 'Quote')}
                >
                  <Quote size={14} />
                </button>
                <button
                  type="button"
                  className={styles.toolBtn}
                  title="Link (Ctrl+K)"
                  onClick={() => insertFormatting('[', '](https://)', 'Link')}
                >
                  <Link size={14} />
                </button>
              </div>
            </div>
          )}
      </div>

      <div className={styles.editorArea} style={{ minHeight }}>
        {activeTab === 'write' ? (
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            readOnly={readOnly}
            style={{ minHeight }}
            rows={10}
          />
        ) : (
          <div className={styles.previewArea} style={{ minHeight }}>
            {value.trim() ? (
              <MarkdownRenderer content={value} allowSaveSnippet={false} />
            ) : (
              <div className={styles.emptyPreview}>Nothing to preview yet. Start typing in Write mode.</div>
            )}
          </div>
        )}
      </div>

      <div className={styles.statusBar}>
        <div className={styles.statGroup}>
          <span className={styles.statItem}>
            <strong>{wordCount}</strong> {wordCount === 1 ? 'word' : 'words'}
          </span>
          <span className={styles.statItem}>
            <strong>{charCount}</strong> characters
          </span>
          {wordCount > 10 && (
            <span className={styles.statItem}>~{readingTimeMinutes} min read</span>
          )}
        </div>
        <span className={styles.hintText}>Markdown supported</span>
      </div>
    </div>
  );
}

NoteEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  minHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  autoFocus: PropTypes.bool,
  readOnly: PropTypes.bool,
  className: PropTypes.string,
  initialTab: PropTypes.oneOf(['write', 'preview']),
};

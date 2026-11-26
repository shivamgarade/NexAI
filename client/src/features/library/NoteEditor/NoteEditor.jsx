import { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Sparkles,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Quote,
  Minus,
  Eye,
  Edit3,
  Loader2,
  Send,
  X,
  Wand2,
} from 'lucide-react';
import { MarkdownRenderer } from '@/features/chat/MarkdownRenderer';
import { libraryApi } from '@/lib/api/library.api';
import { toast } from '@/store/uiStore';
import { cn } from '@/lib/utils/cn';
import styles from './NoteEditor.module.scss';

const SLASH_COMMANDS = [
  {
    id: 'ai',
    title: 'Ask AI to write...',
    description: 'Generate, brainstorm, outline or draft with Gemini',
    icon: <Sparkles size={16} className={styles.aiSparkleIcon} />,
    isAi: true,
  },
  {
    id: 'h1',
    title: 'Heading 1',
    description: 'Top-level section title',
    icon: <Heading1 size={16} />,
    prefix: '# ',
  },
  {
    id: 'h2',
    title: 'Heading 2',
    description: 'Key subsection header',
    icon: <Heading2 size={16} />,
    prefix: '## ',
  },
  {
    id: 'h3',
    title: 'Heading 3',
    description: 'Minor section header',
    icon: <Heading3 size={16} />,
    prefix: '### ',
  },
  {
    id: 'bullet',
    title: 'Bulleted list',
    description: 'Standard bullet point list',
    icon: <List size={16} />,
    prefix: '- ',
  },
  {
    id: 'number',
    title: 'Numbered list',
    description: 'Sequential numbered list',
    icon: <ListOrdered size={16} />,
    prefix: '1. ',
  },
  {
    id: 'todo',
    title: 'To-do checklist',
    description: 'Trackable task item',
    icon: <CheckSquare size={16} />,
    prefix: '- [ ] ',
  },
  {
    id: 'quote',
    title: 'Quote block',
    description: 'Highlight an excerpt or quotation',
    icon: <Quote size={16} />,
    prefix: '> ',
  },
  {
    id: 'code',
    title: 'Code block',
    description: 'Syntax-highlighted code container',
    icon: <Code size={16} />,
    prefix: '```javascript\n',
    suffix: '\n```',
  },
  {
    id: 'hr',
    title: 'Divider',
    description: 'Visually divide sections',
    icon: <Minus size={16} />,
    prefix: '\n---\n',
  },
];

const AI_QUICK_ACTIONS = [
  { label: 'Draft Outline', prompt: 'Create a structured outline with key bullet points for this topic:' },
  { label: 'Summarize', prompt: 'Write a concise summary of the key takeaways from this note:' },
  { label: 'Fix Grammar', prompt: 'Polish the grammar, tone, and readability of the following text while preserving its meaning:' },
  { label: 'Expand Details', prompt: 'Expand on the following ideas with concrete examples and in-depth details:' },
];

export function NoteEditor({
  value = '',
  onChange,
  placeholder = 'Type your note... Press "/" for Notion-style blocks & AI writer',
  minHeight = 260,
  autoFocus = false,
  readOnly = false,
  className = '',
  initialTab = 'write',
}) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'write' | 'preview'
  const textareaRef = useRef(null);

  // Slash menu state
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  // Inline AI Assistant state
  const [isAiBarOpen, setIsAiBarOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const aiInputRef = useRef(null);

  // Filter slash commands based on typed query
  const filteredCommands = SLASH_COMMANDS.filter((cmd) => {
    if (!slashFilter.trim()) return true;
    const q = slashFilter.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.id.toLowerCase().includes(q)
    );
  });

  // Clamp selected index
  useEffect(() => {
    setSlashSelectedIndex(0);
  }, [slashFilter]);

  const insertTextAtCursor = useCallback(
    (insertion, replaceLength = 0) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const before = value.substring(0, Math.max(0, start - replaceLength));
      const after = value.substring(end);

      const nextVal = `${before}${insertion}${after}`;
      onChange?.(nextVal);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newPos = before.length + insertion.length;
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    },
    [value, onChange],
  );

  const handleSelectCommand = (cmd) => {
    setIsSlashMenuOpen(false);
    // Replace the "/" and any filter query typed
    const replaceLen = slashFilter.length + 1;

    if (cmd.isAi) {
      // Remove slash token and open AI bar
      insertTextAtCursor('', replaceLen);
      setIsAiBarOpen(true);
      setTimeout(() => aiInputRef.current?.focus(), 50);
      return;
    }

    const insertion = `${cmd.prefix || ''}${cmd.suffix || ''}`;
    insertTextAtCursor(insertion, replaceLen);
  };

  const handleAiGenerate = async (customPrompt) => {
    const promptToSend = (customPrompt || aiPrompt).trim();
    if (!promptToSend) return;

    setIsAiGenerating(true);
    try {
      const res = await libraryApi.aiWrite({
        prompt: promptToSend,
        context: value,
      });

      const generated = res?.data?.data?.text || res?.data?.text || '';
      if (generated) {
        const insertion = value.trim() ? `\n\n${generated}\n` : `${generated}\n`;
        onChange?.(`${value}${insertion}`);
        toast.success('AI content inserted into note');
        setIsAiBarOpen(false);
        setAiPrompt('');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to generate AI content');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (readOnly) return;

    // Handle Slash Menu Navigation
    if (isSlashMenuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0,
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1,
        );
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[slashSelectedIndex]) {
          handleSelectCommand(filteredCommands[slashSelectedIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsSlashMenuOpen(false);
        return;
      }
    }

    // Tab key indent
    if (e.key === 'Tab') {
      e.preventDefault();
      insertTextAtCursor('  ');
      return;
    }

    // Ctrl/Cmd shortcuts
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      insertFormatting('**', '**', 'bold text');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      insertFormatting('*', '*', 'italic text');
      return;
    }
  };

  const insertFormatting = (prefix, suffix = '', defaultText = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || defaultText;

    const before = value.substring(0, start);
    const after = value.substring(end);

    const replacement = `${prefix}${selectedText}${suffix}`;
    onChange?.(`${before}${replacement}${after}`);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + prefix.length + selectedText.length;
      textarea.setSelectionRange(start + prefix.length, newPos);
    }, 0);
  };

  const handleTextareaChange = (e) => {
    const val = e.target.value;
    onChange?.(val);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);

    // Look for slash trigger on current line
    const match = textBeforeCursor.match(/(?:^|\n)\/([a-zA-Z0-9_-]*)$/);
    if (match) {
      setIsSlashMenuOpen(true);
      setSlashFilter(match[1]);
    } else if (isSlashMenuOpen) {
      setIsSlashMenuOpen(false);
    }
  };

  // Word and read time statistics
  const wordCount = value.trim() ? value.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = value.length;
  const readTime = Math.ceil(wordCount / 200) || 1;

  return (
    <div className={cn(styles.notionEditor, className)}>
      {/* Top Controls Header */}
      <div className={styles.topBar}>
        <div className={styles.leftBarActions}>
          <div className={styles.modeTabs}>
            <button
              type="button"
              className={cn(styles.modeTab, activeTab === 'write' && styles.active)}
              onClick={() => setActiveTab('write')}
              title="Edit markdown canvas"
            >
              <Edit3 size={13} />
              <span>Write</span>
            </button>
            <button
              type="button"
              className={cn(styles.modeTab, activeTab === 'preview' && styles.active)}
              onClick={() => setActiveTab('preview')}
              title="Formatted preview"
            >
              <Eye size={13} />
              <span>Preview</span>
            </button>
          </div>

          <button
            type="button"
            className={styles.askAiPill}
            onClick={() => setIsAiBarOpen((prev) => !prev)}
            title="Ask AI to draft, summarize or polish"
          >
            <Wand2 size={13} />
            <span>Ask AI Co-Writer</span>
          </button>
        </div>

        <div className={styles.statsPill}>
          <span>{wordCount} words</span>
          <span className={styles.statsDot}>•</span>
          <span>{readTime} min read</span>
        </div>
      </div>

      {/* Inline AI Assistant Bar */}
      {isAiBarOpen && (
        <div className={styles.aiAssistDrawer}>
          <div className={styles.aiInputRow}>
            <Sparkles size={16} className={styles.aiIcon} />
            <input
              ref={aiInputRef}
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAiGenerate();
                } else if (e.key === 'Escape') {
                  setIsAiBarOpen(false);
                }
              }}
              placeholder="Ask AI to write anything... e.g. 'Draft an introduction to microservices', 'Summarize key takeaways'"
              className={styles.aiPromptInput}
              disabled={isAiGenerating}
            />
            {isAiGenerating ? (
              <Loader2 size={16} className={styles.spinner} />
            ) : (
              <button
                type="button"
                className={styles.aiSubmitBtn}
                onClick={() => handleAiGenerate()}
                disabled={!aiPrompt.trim()}
                title="Generate with Gemini Flash"
              >
                <Send size={14} />
              </button>
            )}
            <button
              type="button"
              className={styles.aiCloseBtn}
              onClick={() => setIsAiBarOpen(false)}
              aria-label="Close AI Writer"
            >
              <X size={14} />
            </button>
          </div>

          <div className={styles.aiQuickChips}>
            {AI_QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                className={styles.aiQuickChip}
                onClick={() => {
                  setAiPrompt(action.prompt);
                  handleAiGenerate(action.prompt);
                }}
                disabled={isAiGenerating}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Canvas Area */}
      {activeTab === 'write' ? (
        <div className={styles.canvasContainer}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            readOnly={readOnly}
            style={{ minHeight: `${minHeight}px` }}
            className={styles.textareaCanvas}
          />

          {/* Notion-Style Floating Slash Command Menu */}
          {isSlashMenuOpen && filteredCommands.length > 0 && (
            <div className={styles.slashMenu}>
              <div className={styles.slashHeader}>
                <span>Insert Blocks & AI</span>
                <span className={styles.slashHint}>ESC to close</span>
              </div>
              <div className={styles.slashItemsList} role="listbox">
                {filteredCommands.map((cmd, idx) => (
                  <button
                    key={cmd.id}
                    type="button"
                    role="option"
                    aria-selected={idx === slashSelectedIndex}
                    className={cn(
                      styles.slashItem,
                      idx === slashSelectedIndex && styles.slashItemActive,
                      cmd.isAi && styles.slashItemAi,
                    )}
                    onClick={() => handleSelectCommand(cmd)}
                  >
                    <span className={styles.slashItemIcon}>{cmd.icon}</span>
                    <div className={styles.slashItemMeta}>
                      <span className={styles.slashItemTitle}>{cmd.title}</span>
                      <span className={styles.slashItemDesc}>{cmd.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          className={styles.previewCanvas}
          style={{ minHeight: `${minHeight}px` }}
        >
          {value.trim() ? (
            <MarkdownRenderer content={value} />
          ) : (
            <div className={styles.emptyPreviewNotice}>
              <p>Nothing to preview yet. Switch to Write mode or use &quot;/&quot; to start writing.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

NoteEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  minHeight: PropTypes.number,
  autoFocus: PropTypes.bool,
  readOnly: PropTypes.bool,
  className: PropTypes.string,
  initialTab: PropTypes.string,
};

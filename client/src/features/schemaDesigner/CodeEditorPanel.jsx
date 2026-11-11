import { useRef, useMemo, useState, useEffect } from 'react';
import {
  Copy,
  Check,
  AlertCircle,
  Sparkles,
  Download,
  FileCode2,
  CheckCircle2,
} from 'lucide-react';
import Prism from 'prismjs';
import { useSchemaStore } from '@/store/schemaStore';
import { Button } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import styles from './CodeEditorPanel.module.scss';

// Custom Prism Grammar for Eraser-style ER Language
if (Prism && !Prism.languages.er) {
  Prism.languages.er = {
    comment: /\/\/.*/,
    attr: {
      pattern: /\[[^\]]*\]/,
      inside: {
        key: /\b\w+(?=:)/,
        punctuation: /[[\]:]/,
        value: /:\s*\w+/,
      },
    },
    relation: {
      pattern: /^\s*[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+\s*(?:<>|[<>-])\s*[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+/m,
      inside: {
        operator: /<>|[<>-]/,
        punctuation: /\./,
        variable: /[a-zA-Z0-9_]+/,
      },
    },
    entity: {
      pattern: /^\s*[a-zA-Z0-9_]+(?=\s*(?:\[[^\]]*\])?\s*\{)/m,
      alias: 'class-name',
    },
    modifier: {
      pattern: /\b(?:pk|unique|nullable)\b/,
      alias: 'keyword',
    },
    type: {
      pattern: /\b(?:uuid|string|int|decimal|datetime|boolean|text|json|date|float)\b/,
      alias: 'builtin',
    },
    punctuation: /[{}]/,
  };
}

export function CodeEditorPanel() {
  const {
    code,
    setCode,
    model,
    parseErrors,
    exportSQL,
    exportPrisma,
    generateSchema,
    isLoading,
    aiPreview,
  } = useSchemaStore();

  const [copied, setCopied] = useState(false);
  const [localCode, setLocalCode] = useState(code);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const lineCount = Math.max(1, (localCode || '').split('\n').length);

  // Autocomplete Suggestions State
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [suggestionCoords, setSuggestionCoords] = useState(null); // { top, left, prefix, replaceStart, replaceEnd }

  // Custom Right-Click Context Menu State
  const [contextMenu, setContextMenu] = useState(null); // { x, y }

  const debounceRef = useRef(null);
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const preOverlayRef = useRef(null);

  // Sync syntax overlay and line numbers scroll with textarea
  const handleScroll = (e) => {
    const { scrollTop, scrollLeft } = e.target;
    if (preOverlayRef.current) {
      preOverlayRef.current.scrollTop = scrollTop;
      preOverlayRef.current.scrollLeft = scrollLeft;
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop;
    }
  };

  // Prism highlighted HTML for code overlay
  const highlightedCodeHtml = useMemo(() => {
    if (!localCode) return '';
    if (Prism && Prism.languages.er) {
      try {
        return Prism.highlight(localCode, Prism.languages.er, 'er');
      } catch {
        return localCode;
      }
    }
    return localCode;
  }, [localCode]);

  // Sync from store when canvas or AI preview updates
  useEffect(() => {
    if (aiPreview && aiPreview.code) {
      setLocalCode(aiPreview.code);
    } else {
      setLocalCode(code);
    }
  }, [code, aiPreview]);

  // Handle typing with instant 60ms debounce for real-time canvas sync
  const handleChange = (e) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;
    setLocalCode(val);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setCode(val);
    }, 60);

    computeSuggestions(val, cursorPos);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Compute context-aware suggestions (types, modifiers, table.field relations)
  const computeSuggestions = (text, cursorPos) => {
    if (!text || cursorPos === 0) {
      setSuggestions([]);
      return;
    }

    const textBefore = text.slice(0, cursorPos);
    const lineStart = textBefore.lastIndexOf('\n') + 1;
    const currentLine = textBefore.slice(lineStart);
    const lineNum = (textBefore.match(/\n/g) || []).length;

    // 1. Check if user typed dot after entity name: e.g. "users."
    const dotMatch = currentLine.match(/([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]*)$/);
    if (dotMatch) {
      const entityName = dotMatch[1].toLowerCase();
      const partial = dotMatch[2].toLowerCase();
      const entity = (model.entities || []).find((e) => e.name.toLowerCase() === entityName);

      if (entity && entity.fields?.length) {
        const matches = entity.fields
          .filter((f) => f.name.toLowerCase().startsWith(partial))
          .map((f) => ({
            label: `${f.name}`,
            detail: `${f.type}${f.pk ? ' pk' : ''}`,
            insertText: f.name,
            prefix: partial,
            type: 'field',
          }));

        if (matches.length > 0) {
          setSuggestions(matches);
          setSuggestionIndex(0);
          setSuggestionCoords({
            top: (lineNum + 1) * 22 + 10,
            left: Math.min(300, currentLine.length * 7.8 + 50),
            replaceStart: cursorPos - partial.length,
            replaceEnd: cursorPos,
          });
          return;
        }
      }
    }

    // 2. Check if user is typing field types or modifiers inside an entity block
    const lastWordMatch = currentLine.match(/([a-zA-Z0-9_]+)$/);
    if (lastWordMatch && currentLine.trim().length > 0) {
      const word = lastWordMatch[1].toLowerCase();
      const tokens = currentLine.trim().split(/\s+/);

      const STANDARD_TYPES = ['uuid', 'string', 'int', 'decimal', 'datetime', 'boolean', 'text', 'json', 'date', 'float'];
      const MODIFIERS = ['pk', 'unique', 'nullable'];

      let pool = [];
      if (tokens.length === 2 && !tokens[0].includes('.')) {
        // Second token on a field row is usually the type
        pool = STANDARD_TYPES.map((t) => ({ label: t, detail: 'type', insertText: t, type: 'type' }));
      } else if (tokens.length >= 3 && !tokens[0].includes('.')) {
        // Subsequent tokens are modifiers
        pool = MODIFIERS.map((m) => ({ label: m, detail: 'modifier', insertText: m, type: 'modifier' }));
      } else if (tokens.length === 1 && !currentLine.includes('{')) {
        // Start of relation line or new table name
        const entityNames = (model.entities || []).map((e) => ({
          label: e.name,
          detail: 'table',
          insertText: e.name,
          type: 'entity',
        }));
        pool = entityNames;
      }

      const matches = pool.filter((item) => item.label.toLowerCase().startsWith(word) && item.label.toLowerCase() !== word);

      if (matches.length > 0) {
        setSuggestions(matches);
        setSuggestionIndex(0);
        setSuggestionCoords({
          top: (lineNum + 1) * 22 + 10,
          left: Math.min(320, currentLine.length * 7.8 + 50),
          replaceStart: cursorPos - word.length,
          replaceEnd: cursorPos,
        });
        return;
      }
    }

    setSuggestions([]);
  };

  // Apply picked autocomplete suggestion
  const applySuggestion = (item) => {
    if (!item || !suggestionCoords || !textareaRef.current) return;
    const { replaceStart, replaceEnd } = suggestionCoords;
    const before = localCode.slice(0, replaceStart);
    const after = localCode.slice(replaceEnd);
    const updated = before + item.insertText + after;
    const nextCursor = replaceStart + item.insertText.length;

    setLocalCode(updated);
    setCode(updated);
    setSuggestions([]);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  // Duplicate current line down (Alt + Down Arrow)
  const duplicateCurrentLine = () => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const selStart = textarea.selectionStart;
    const val = textarea.value;

    const lineStart = val.lastIndexOf('\n', selStart - 1) + 1;
    let lineEnd = val.indexOf('\n', selStart);
    if (lineEnd === -1) lineEnd = val.length;

    const currentLine = val.slice(lineStart, lineEnd);
    const updated = val.slice(0, lineEnd) + '\n' + currentLine + val.slice(lineEnd);
    const nextCursor = selStart + currentLine.length + 1;

    setLocalCode(updated);
    setCode(updated);

    requestAnimationFrame(() => {
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
    toast.info('Duplicated line');
  };

  // Keyboard shortcut handler
  const handleKeyDown = (e) => {
    // 1. If suggestions menu is open: handle navigate / select / dismiss
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applySuggestion(suggestions[suggestionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setSuggestions([]);
        return;
      }
    }

    // 2. Alt + Down Arrow: Duplicate current line
    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      duplicateCurrentLine();
      return;
    }

    // 3. Tab key support inside code editor (inserts 2 spaces)
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      const updated = val.substring(0, start) + '  ' + val.substring(end);
      setLocalCode(updated);
      setCode(updated);

      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  };

  // Right-click context menu
  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
    });
  };

  // Close context menu on outside click
  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  const handleCopy = async () => {
    if (!localCode) return;
    try {
      await navigator.clipboard.writeText(localCode);
      setCopied(true);
      toast.success('ER code copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleExportSQL = () => {
    const sql = exportSQL();
    if (!sql) return;
    const blob = new Blob([sql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema.sql';
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    toast.success('Downloaded schema.sql');
  };

  const handleExportPrisma = () => {
    const prisma = exportPrisma();
    if (!prisma) return;
    const blob = new Blob([prisma], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema.prisma';
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    toast.success('Downloaded schema.prisma');
  };

  const handleFixWithAI = () => {
    if (!parseErrors.length) return;
    const errorDetails = parseErrors.map((e) => `Line ${e.line}: ${e.message}`).join('\n');
    generateSchema(
      `Fix the following syntax errors in the ER code:\n${errorDetails}\n\nCurrent code:\n${localCode}`
    );
  };

  const hasErrors = parseErrors.length > 0;

  return (
    <aside className={styles.editorContainer}>
      {/* Editor Header Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.titleGroup}>
          <FileCode2 size={14} className="text-accent" />
          <span className={styles.toolbarTitle}>Schema Code</span>

          {/* Real-time Sync Status Pill */}
          {aiPreview ? (
            <span className={styles.syncPreviewPill} title="Previewing AI proposed schema">
              <Sparkles size={10} />
              <span>AI Proposal</span>
            </span>
          ) : hasErrors ? (
            <span className={styles.syncErrorPill} title={parseErrors[0]?.message}>
              <AlertCircle size={10} />
              <span>Line {parseErrors[0]?.line} error</span>
            </span>
          ) : (
            <span className={styles.syncOkPill}>
              <CheckCircle2 size={10} />
              <span>Synced</span>
            </span>
          )}
        </div>

        <div className={styles.actions}>
          <div className={styles.exportWrapper}>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => setShowExportMenu(!showExportMenu)}
              title="Export as SQL or Prisma"
            >
              <Download size={13} />
              <span>Export</span>
            </button>

            {showExportMenu && (
              <div className={styles.exportDropdown}>
                <button type="button" onClick={handleExportSQL} className={styles.menuItem}>
                  PostgreSQL DDL (.sql)
                </button>
                <button type="button" onClick={handleExportPrisma} className={styles.menuItem}>
                  Prisma Schema (.prisma)
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className={styles.toolBtn}
            onClick={handleCopy}
            title="Copy ER Code"
          >
            {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Editor Body with Line Numbers */}
      <div className={styles.editorBody}>
        <div className={styles.lineNumbers} ref={lineNumbersRef}>
          {Array.from({ length: lineCount }, (_, i) => i + 1).map((num) => {
            const hasError = parseErrors.some((e) => e.line === num);
            return (
              <div
                key={num}
                className={`${styles.lineNumber} ${hasError ? styles.lineHasError : ''}`}
              >
                {num}
              </div>
            );
          })}
        </div>

        <div className={styles.editorContentArea}>
          <pre
            ref={preOverlayRef}
            className={styles.syntaxOverlay}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: highlightedCodeHtml + '\n' }}
          />

          <textarea
            ref={textareaRef}
            value={localCode}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onContextMenu={handleContextMenu}
            onScroll={handleScroll}
            placeholder="// Define entities and relationships:&#10;users {&#10;  id uuid pk&#10;  name string&#10;}&#10;&#10;posts {&#10;  id uuid pk&#10;  userId uuid&#10;}&#10;&#10;// relations&#10;posts.userId > users.id"
            className={styles.codeTextarea}
            spellCheck={false}
          />

          {/* Autocomplete Suggestions Popup */}
          {suggestions.length > 0 && suggestionCoords && (
            <div
              className={styles.suggestionBox}
              style={{
                top: `${suggestionCoords.top}px`,
                left: `${suggestionCoords.left}px`,
              }}
            >
              {suggestions.map((item, idx) => (
                <div
                  key={item.label}
                  className={`${styles.suggestionItem} ${
                    idx === suggestionIndex ? styles.suggestionActive : ''
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applySuggestion(item);
                  }}
                >
                  <span className={styles.sugLabel}>{item.label}</span>
                  <span className={styles.sugDetail}>{item.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right-Click Context Menu */}
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={styles.ctxItem}
            onClick={async () => {
              const sel = textareaRef.current?.value.substring(
                textareaRef.current.selectionStart,
                textareaRef.current.selectionEnd
              );
              await navigator.clipboard.writeText(sel || localCode);
              setContextMenu(null);
              toast.success('Copied to clipboard');
            }}
          >
            Copy
          </button>
          <button
            type="button"
            className={styles.ctxItem}
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                if (text && textareaRef.current) {
                  const ta = textareaRef.current;
                  const start = ta.selectionStart;
                  const end = ta.selectionEnd;
                  const updated = localCode.substring(0, start) + text + localCode.substring(end);
                  setLocalCode(updated);
                  setCode(updated);
                }
              } catch {
                toast.error('Clipboard paste denied by browser permissions');
              }
              setContextMenu(null);
            }}
          >
            Paste
          </button>
          <div className={styles.ctxDivider} />
          <button
            type="button"
            className={styles.ctxItem}
            onClick={() => {
              duplicateCurrentLine();
              setContextMenu(null);
            }}
          >
            Duplicate Line (Alt+↓)
          </button>
        </div>
      )}

      {/* Parse Errors Diagnostic Banner */}
      {parseErrors.length > 0 && (
        <div className={styles.errorBanner}>
          <div className={styles.errorContent}>
            <AlertCircle size={15} className={styles.errIcon} />
            <div className={styles.errorText}>
              <span className={styles.errTitle}>Syntax Error</span>
              <span className={styles.errDesc}>
                Line {parseErrors[0].line}: {parseErrors[0].message}
              </span>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Sparkles size={12} />}
            onClick={handleFixWithAI}
            disabled={isLoading}
            className={styles.fixBtn}
          >
            Fix with AI
          </Button>
        </div>
      )}
    </aside>
  );
}

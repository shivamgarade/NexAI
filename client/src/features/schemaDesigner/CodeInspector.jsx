import { useRef, useMemo, useState, useEffect } from 'react';
import { FileCode, Download, Code2, Copy, Check, RefreshCw, Sparkles } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-sql';
import { useSchemaStore } from '@/store/schemaStore';
import { toast } from '@/components/ui/Toast';
import styles from './CodeInspector.module.scss';

const TABS = [
  { id: 'mongoose', label: 'Mongoose (MongoDB)', lang: 'javascript', ext: 'models.js' },
  { id: 'sql', label: 'PostgreSQL (DDL)', lang: 'sql', ext: 'schema.sql' },
  { id: 'prisma', label: 'Prisma Schema', lang: 'javascript', ext: 'schema.prisma' },
  { id: 'typescript', label: 'TypeScript Interfaces', lang: 'typescript', ext: 'types.ts' },
];

export function CodeInspector() {
  const { currentSchema, activeDialect, setActiveDialect, updateCodeOutput, syncCodeToDiagram } =
    useSchemaStore();
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'modified' | 'error'

  const textareaRef = useRef(null);
  const preRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const syncTimeoutRef = useRef(null);

  const activeTabConfig = TABS.find((t) => t.id === activeDialect) || TABS[0];
  const activeCode = currentSchema?.codeOutputs?.[activeDialect] || '';

  // Calculate total lines
  const lineCount = useMemo(() => {
    return Math.max(1, (activeCode.match(/\n/g) || []).length + 1);
  }, [activeCode]);

  // Syntax highlight with Prism in real-time
  const highlightedCode = useMemo(() => {
    if (!activeCode) return '';
    try {
      const grammar = Prism.languages[activeTabConfig.lang] || Prism.languages.javascript;
      return Prism.highlight(activeCode, grammar, activeTabConfig.lang);
    } catch {
      return activeCode;
    }
  }, [activeCode, activeTabConfig.lang]);

  // Synchronize scrolling between textarea, highlighted backdrop, and line numbers
  const handleScroll = (e) => {
    const { scrollTop, scrollLeft } = e.target;
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop;
    }
  };

  // Debounced auto-sync from Code to Diagram
  const handleCodeChange = (e) => {
    const newCode = e.target.value;
    updateCodeOutput(activeDialect, newCode);
    setSyncStatus('modified');

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      const ok = syncCodeToDiagram(newCode, activeDialect);
      if (ok) {
        setSyncStatus('synced');
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  const handleManualSync = () => {
    if (!activeCode) return;
    setIsSyncing(true);
    const success = syncCodeToDiagram(activeCode, activeDialect);
    setIsSyncing(false);

    if (success) {
      setSyncStatus('synced');
      toast.success('Synced code changes into Architecture Diagram!');
    } else {
      toast.info('Could not parse new entities. Code preserved.');
    }
  };

  const handleCopy = async () => {
    if (!activeCode) return;
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(`Copied ${activeTabConfig.label} code`);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleDownload = () => {
    if (!activeCode) return;
    try {
      const blob = new Blob([activeCode], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `${currentSchema?.title?.toLowerCase().replace(/\s+/g, '_') || 'schema'}_${activeTabConfig.ext}`
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`Downloaded ${activeTabConfig.ext}`);
    } catch {
      toast.error('Failed to trigger download');
    }
  };

  return (
    <div className={styles.inspectorContainer}>
      <div className={styles.tabBar}>
        <div className={styles.tabsList} role="tablist">
          {TABS.map((tab) => {
            const isActive = activeDialect === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                type="button"
                className={`${styles.tabBtn} ${isActive ? styles.active : ''}`}
                onClick={() => setActiveDialect(tab.id)}
              >
                <Code2 size={13} className={styles.dialectIcon} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeCode && (
          <div className={styles.tabActions}>
            <button
              type="button"
              className={`${styles.btnAction} ${styles.btnSync} ${syncStatus === 'synced' ? styles.isSynced : ''}`}
              onClick={handleManualSync}
              title="Sync code changes with visual canvas"
              disabled={isSyncing}
            >
              <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
              <span>{syncStatus === 'synced' ? 'Synced to Canvas' : 'Sync to Canvas'}</span>
            </button>

            <button
              type="button"
              className={styles.btnAction}
              onClick={handleCopy}
              title="Copy code to clipboard"
            >
              {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              className={styles.btnAction}
              onClick={handleDownload}
              title={`Download .${activeTabConfig.ext.split('.').pop()}`}
            >
              <Download size={13} />
              <span>Export</span>
            </button>
          </div>
        )}
      </div>

      <div className={styles.editorArea}>
        {activeCode ? (
          <>
            {/* Line numbers gutter */}
            <div className={styles.lineNumbers} ref={lineNumbersRef} aria-hidden="true">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Code Stage: Synchronized Prism Syntax Backdrop + Transparent Textarea */}
            <div className={styles.codeStage}>
              <pre ref={preRef} className={styles.highlightBackdrop} aria-hidden="true">
                <code
                  className={`language-${activeTabConfig.lang}`}
                  dangerouslySetInnerHTML={{ __html: highlightedCode }}
                />
              </pre>

              <textarea
                ref={textareaRef}
                className={styles.codeTextarea}
                value={activeCode}
                onChange={handleCodeChange}
                onScroll={handleScroll}
                spellCheck={false}
                placeholder="Write or edit code here..."
              />
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <FileCode size={40} className="opacity-40" />
            <h4>No Code Generated</h4>
            <p>
              Generated production models for Mongoose, PostgreSQL, Prisma, and TypeScript will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

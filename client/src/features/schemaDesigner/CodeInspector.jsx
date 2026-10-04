import { useState, useMemo } from 'react';
import { FileCode, Download, Code2, Copy, Check, Edit3, Eye } from 'lucide-react';
import { useSchemaStore } from '@/store/schemaStore';
import { CodeBlock } from '@/features/chat/CodeBlock';
import { toast } from '@/components/ui/Toast';
import styles from './CodeInspector.module.scss';

const TABS = [
  { id: 'mongoose', label: 'Mongoose (MongoDB)', lang: 'javascript', ext: 'models.js' },
  { id: 'sql', label: 'PostgreSQL (DDL)', lang: 'sql', ext: 'schema.sql' },
  { id: 'prisma', label: 'Prisma Schema', lang: 'javascript', ext: 'schema.prisma' },
  { id: 'typescript', label: 'TypeScript Interfaces', lang: 'typescript', ext: 'types.ts' },
];

export function CodeInspector() {
  const { currentSchema, activeDialect, setActiveDialect, updateCodeOutput } = useSchemaStore();
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeTabConfig = TABS.find((t) => t.id === activeDialect) || TABS[0];
  const activeCode = currentSchema?.codeOutputs?.[activeDialect] || '';

  const lineCount = useMemo(() => {
    return Math.max(1, (activeCode.match(/\n/g) || []).length + 1);
  }, [activeCode]);

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
              className={`${styles.btnAction} ${isEditing ? styles.active : ''}`}
              onClick={() => setIsEditing(!isEditing)}
              title={isEditing ? 'Switch to syntax preview' : 'Edit code directly'}
            >
              {isEditing ? <Eye size={13} /> : <Edit3 size={13} />}
              <span>{isEditing ? 'Preview' : 'Edit'}</span>
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
          isEditing ? (
            <>
              <div className={styles.lineNumbers} aria-hidden="true">
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <textarea
                className={styles.codeTextarea}
                value={activeCode}
                onChange={(e) => updateCodeOutput(activeDialect, e.target.value)}
                spellCheck={false}
                placeholder="Write or edit code here..."
              />
            </>
          ) : (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <CodeBlock
                language={activeTabConfig.lang}
                value={activeCode}
              />
            </div>
          )
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

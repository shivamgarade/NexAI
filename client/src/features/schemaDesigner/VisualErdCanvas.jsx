import { useState } from 'react';
import { Network, Maximize2, Minimize2, Copy, Check, Info } from 'lucide-react';
import { useSchemaStore } from '@/store/schemaStore';
import { MermaidBlock } from '@/features/chat/MermaidBlock';
import { toast } from '@/components/ui/Toast';
import styles from './VisualErdCanvas.module.scss';

export function VisualErdCanvas() {
  const { currentSchema, isLoading } = useSchemaStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyMermaid = async () => {
    if (!currentSchema?.mermaidErDiagram) return;
    try {
      await navigator.clipboard.writeText(currentSchema.mermaidErDiagram);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Mermaid ERD syntax copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const entityCount = currentSchema?.entities?.length || 0;
  const fieldCount =
    currentSchema?.entities?.reduce((acc, curr) => acc + (curr.fields?.length || 0), 0) || 0;

  return (
    <div className={styles.canvasContainer}>
      <div className={styles.topBar}>
        <div className={styles.titleArea}>
          <Network size={16} className="text-accent" />
          <h4>Entity Relationship Diagram (ERD)</h4>
          {currentSchema && (
            <div className={styles.badgeGroup}>
              <span className={styles.metaBadge}>{entityCount} Entities</span>
              <span className={styles.metaBadge}>{fieldCount} Fields</span>
            </div>
          )}
        </div>

        {currentSchema && (
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.btnAction}
              onClick={handleCopyMermaid}
              title="Copy raw Mermaid code"
            >
              {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy ERD'}</span>
            </button>

            <button
              type="button"
              className={styles.btnAction}
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
            </button>
          </div>
        )}
      </div>

      <div className={styles.diagramArea}>
        {currentSchema?.mermaidErDiagram ? (
          <MermaidBlock
            chart={currentSchema.mermaidErDiagram}
            isStreaming={isLoading}
          />
        ) : (
          <div className={styles.emptyArea}>
            <Network size={44} className={styles.emptyIcon} />
            <h4>No Active Data Model</h4>
            <p>
              Enter domain requirements above or click a starter template to generate an interactive
              visual entity-relationship diagram.
            </p>
          </div>
        )}
      </div>

      {currentSchema?.designNotes?.length > 0 && (
        <div className={styles.designNotesSection}>
          <div className="flex items-center gap-1 mb-1">
            <Info size={13} className="text-accent" />
            <h5>Architectural Notes & Constraints</h5>
          </div>
          <ul>
            {currentSchema.designNotes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Fullscreen Modal View */}
      {isFullscreen && (
        <div className={styles.fullscreenModal}>
          <div className={styles.modalHeader}>
            <div className="flex items-center gap-2">
              <Network size={18} className="text-accent" />
              <h3>{currentSchema?.title || 'Entity Relationship Diagram'}</h3>
            </div>
            <button
              type="button"
              className={styles.btnAction}
              onClick={() => setIsFullscreen(false)}
            >
              <Minimize2 size={14} />
              <span>Close</span>
            </button>
          </div>
          <div className={styles.modalBody}>
            <MermaidBlock chart={currentSchema?.mermaidErDiagram || ''} />
          </div>
        </div>
      )}
    </div>
  );
}

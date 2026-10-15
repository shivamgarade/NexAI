import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Database,
  Bookmark,
  Columns2,
  Network,
  Code2,
  Edit2,
  Check,
  RotateCcw,
} from 'lucide-react';
import { useSchemaStore } from '@/store/schemaStore';
import { Button } from '@/components/ui';
import styles from './SchemaHeader.module.scss';

export function SchemaHeader({ viewMode = 'split', setViewMode }) {
  const { title, setTitle, reset } = useSchemaStore();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title || 'Untitled Schema');
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  useEffect(() => {
    setTempTitle(title || 'Untitled Schema');
  }, [title]);

  const handleSaveTitle = () => {
    if (tempTitle.trim()) {
      setTitle(tempTitle.trim());
    }
    setIsEditingTitle(false);
  };

  return (
    <header className={styles.headerContainer}>
      {/* LEFT: EDITABLE ER DIAGRAM TITLE */}
      <div className={styles.titleArea}>
        <div className={styles.iconWrapper}>
          <Database size={15} className="text-accent" />
        </div>

        {isEditingTitle ? (
          <div className={styles.titleEditRow}>
            <input
              type="text"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
              autoFocus
              className={styles.titleInput}
            />
            <button type="button" className={styles.titleCheckBtn} onClick={handleSaveTitle}>
              <Check size={12} />
            </button>
          </div>
        ) : (
          <div className={styles.titleDisplayRow} onClick={() => setIsEditingTitle(true)}>
            <span className={styles.brandTag}>ER Diagram</span>
            <span className={styles.divider}>/</span>
            <h1 className={styles.titleText}>{title || 'Untitled Schema'}</h1>
            <Edit2 size={11} className={styles.editIcon} />
          </div>
        )}
      </div>

      {/* CENTER: SEGMENTED VIEW CONTROL (Split | Diagram | Code) */}
      {setViewMode && (
        <div className={styles.centerTabs} role="tablist" aria-label="Studio layout view">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'split'}
            className={`${styles.tabBtn} ${viewMode === 'split' ? styles.tabActive : ''}`}
            onClick={() => setViewMode('split')}
            title="Split: Diagram + Code"
          >
            <Columns2 size={13} />
            <span>Split</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'erd'}
            className={`${styles.tabBtn} ${viewMode === 'erd' ? styles.tabActive : ''}`}
            onClick={() => setViewMode('erd')}
            title="Full-Width Diagram"
          >
            <Network size={13} />
            <span>Diagram</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'code'}
            className={`${styles.tabBtn} ${viewMode === 'code' ? styles.tabActive : ''}`}
            onClick={() => setViewMode('code')}
            title="Full-Width Code Editor"
          >
            <Code2 size={13} />
            <span>Code</span>
          </button>
        </div>
      )}

      {/* RIGHT: UNDO/REDO, RESET & SAVE TO LIBRARY */}
      <div className={styles.actions}>
        <div className={styles.historyGroup}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => useSchemaStore.getState().undo()}
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => useSchemaStore.getState().redo()}
            title="Redo (Ctrl+Shift+Z)"
          >
            <RotateCcw size={13} style={{ transform: 'scaleX(-1)' }} />
          </button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          title="Reset canvas"
          className={styles.resetBtn}
        >
          New
        </Button>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Bookmark size={13} />}
          onClick={() => {
            const store = useSchemaStore.getState();
            store.setReviewModalOpen(true);
          }}
          className={styles.saveBtn}
        >
          Save to Library
        </Button>
      </div>
    </header>
  );
}

SchemaHeader.propTypes = {
  viewMode: PropTypes.oneOf(['split', 'erd', 'code']),
  setViewMode: PropTypes.func,
};

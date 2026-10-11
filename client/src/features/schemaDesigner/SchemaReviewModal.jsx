import { useState, useEffect } from 'react';
import { X, Bookmark, Check, Layers } from 'lucide-react';
import { useSchemaStore } from '@/store/schemaStore';
import { Button } from '@/components/ui';
import styles from './SchemaReviewModal.module.scss';

export function SchemaReviewModal() {
  const { currentSchema, isReviewModalOpen, setReviewModalOpen, saveToLibrary } = useSchemaStore();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [tagsInput, setTagsInput] = useState('schema, data-model, database');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentSchema) {
      setTitle(currentSchema.title || 'Database Schema Architecture');
      setSummary(currentSchema.summary || '');
      const dynamicTags = [
        'schema',
        'database',
        ...(currentSchema.entities?.map((e) => e.name.toLowerCase()) || []),
      ].slice(0, 6);
      setTagsInput(Array.from(new Set(dynamicTags)).join(', '));
    }
  }, [currentSchema]);

  if (!isReviewModalOpen || !currentSchema) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    await saveToLibrary({
      title: title.trim(),
      summary: summary.trim(),
      tags,
    });
    setIsSaving(false);
  };

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalContent}>
        <div className={styles.header}>
          <h3>
            <Bookmark size={17} className="text-accent" />
            Review & Save Schema to Library
          </h3>
          <button
            type="button"
            className={styles.btnClose}
            onClick={() => setReviewModalOpen(false)}
            aria-label="Close review modal"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
          <div className={styles.body}>
            <div className={styles.formGroup}>
              <label htmlFor="schema-title">Schema Architecture Title</label>
              <input
                id="schema-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={140}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="schema-summary">Executive Summary / Description</label>
              <textarea
                id="schema-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                placeholder="Brief summary of the data model"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="schema-tags">Tags (comma separated for vector indexing)</label>
              <input
                id="schema-tags"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="schema, ecommerce, postgresql"
              />
            </div>

            <div className={styles.entityListPreview}>
              <div className="flex items-center gap-1">
                <Layers size={13} className="text-accent" />
                <span className={styles.previewLabel}>
                  Included Entities ({currentSchema.entities?.length || 0})
                </span>
              </div>
              <div className={styles.entityBadges}>
                {currentSchema.entities?.map((ent) => (
                  <span key={ent.name} className={styles.entityBadge}>
                    {ent.name} ({ent.fields?.length || 0} cols)
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.footer}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setReviewModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSaving || !title.trim()}
            >
              <Check size={15} />
              {isSaving ? 'Indexing & Saving...' : 'Confirm & Save to Library'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { TagInput } from '@/components/ui/TagInput';
import { Button } from '@/components/ui/Button';
import { NoteEditor } from './NoteEditor';
import { useLibraryStore } from '@/store/libraryStore';
import styles from './EditItemModal.module.scss';

export function EditItemModal() {
  const { isEditModalOpen, editingItem, closeEditModal, updateItem, isUpdating } =
    useLibraryStore();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingItem) {
      setTitle(editingItem.title || '');
      setSummary(editingItem.summary || '');
      setContent(editingItem.content || '');
      setTags(editingItem.tags || []);
      setError('');
    }
  }, [editingItem]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title cannot be empty');
      return;
    }
    setError('');

    try {
      await updateItem(editingItem._id, {
        title: title.trim(),
        summary: summary.trim(),
        content: editingItem.type === 'note' ? content : undefined,
        tags,
      });
    } catch {
      // Handled in store
    }
  };

  if (!editingItem) return null;

  return (
    <Modal
      open={isEditModalOpen}
      onClose={closeEditModal}
      className={styles.modal}
      title="Edit Library Item"
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={error}
            autoFocus
          />
        </div>

        {editingItem.type === 'note' && (
          <div className={styles.field}>
            <span className={styles.label}>Note Content (Interactive Markdown)</span>
            <NoteEditor
              value={content}
              onChange={setContent}
              minHeight={200}
            />
          </div>
        )}

        <div className={styles.field}>
          <Textarea
            label="Summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Tags</span>
          <TagInput tags={tags} onChange={setTags} placeholder="Add tag and press Enter..." />
        </div>

        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={closeEditModal} disabled={isUpdating}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isUpdating}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { SaveItemForm } from './SaveItemForm';
import { SuggestionReview } from './SuggestionReview';
import { useLibraryStore } from '@/store/libraryStore';
import { cn } from '@/lib/utils/cn';
import styles from './SaveItemModal.module.scss';

export function SaveItemModal() {
  const {
    isAddModalOpen,
    addModalPrefill,
    closeAddModal,
    suggestItem,
    isSuggesting,
    suggestError,
    suggestion,
    saveItem,
    isSaving,
  } = useLibraryStore();

  const [stepSuggestion, setStepSuggestion] = useState(null);
  const [lastPayload, setLastPayload] = useState(null);

  // Sync with store suggestion or local state
  const activeSuggestion = suggestion || stepSuggestion;

  const isSnippet = Boolean(
    addModalPrefill?.isSnippet ||
      addModalPrefill?.tags?.includes('snippet') ||
      (addModalPrefill?.type === 'note' && addModalPrefill?.content?.startsWith('```')),
  );

  const handleSuggest = async (payload) => {
    setLastPayload(payload);
    try {
      const result = await suggestItem(payload);
      setStepSuggestion({
        ...result,
        content: payload.content || result?.content,
        tags: payload.tags?.length
          ? [...new Set([...(result?.tags || []), ...payload.tags])]
          : result?.tags,
      });
    } catch {
      // Handled in store toast / error state
    }
  };

  const handleRegenerate = async () => {
    if (lastPayload) {
      await handleSuggest(lastPayload);
    }
  };

  const handleBack = () => {
    setStepSuggestion(null);
    useLibraryStore.setState({ suggestion: null, suggestError: null });
  };

  const handleSave = async (itemData) => {
    try {
      await saveItem(itemData);
      setStepSuggestion(null);
      setLastPayload(null);
    } catch {
      // Handled in store
    }
  };

  const handleClose = () => {
    setStepSuggestion(null);
    setLastPayload(null);
    closeAddModal();
  };

  const modalTitle = activeSuggestion
    ? 'Review & Confirm'
    : isSnippet
      ? 'Save Code Snippet'
      : 'Add to Personal Library';

  return (
    <Modal
      open={isAddModalOpen}
      onClose={handleClose}
      className={cn(styles.modal, isSnippet && styles.snippetModal)}
      title={modalTitle}
    >
      {activeSuggestion ? (
        <SuggestionReview
          suggestion={activeSuggestion}
          onSave={handleSave}
          onBack={handleBack}
          onRegenerate={lastPayload ? handleRegenerate : undefined}
          isSaving={isSaving}
          isRegenerating={isSuggesting}
        />
      ) : (
        <SaveItemForm
          onSuggest={handleSuggest}
          onDirectSave={handleSave}
          isSuggesting={isSuggesting}
          isSaving={isSaving}
          error={suggestError}
          prefill={addModalPrefill}
        />
      )}
    </Modal>
  );
}

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaveItemModal } from './SaveItemModal';
import { useLibraryStore } from '@/store/libraryStore';

describe('SaveItemModal Component', () => {
  const mockCloseAddModal = vi.fn();
  const mockSaveItem = vi.fn();
  const mockSuggestItem = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useLibraryStore.setState({
      isAddModalOpen: true,
      addModalPrefill: null,
      closeAddModal: mockCloseAddModal,
      saveItem: mockSaveItem,
      suggestItem: mockSuggestItem,
      isSaving: false,
      isSuggesting: false,
      suggestError: null,
      suggestion: null,
    });
  });

  it('renders default modal with type tabs when opened without prefill', () => {
    render(<SaveItemModal />);

    expect(screen.getByText('Add to Personal Library')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /web link/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /note \/ text/i })).toBeInTheDocument();
  });

  it('renders dedicated wide snippet modal and hides link tabs when saving a snippet', () => {
    useLibraryStore.setState({
      isAddModalOpen: true,
      addModalPrefill: {
        type: 'note',
        title: 'JAVASCRIPT Snippet: REST Endpoint',
        content: '```javascript\napp.get("/api", (req, res) => res.json({ ok: true }));\n```',
        tags: ['snippet', 'javascript'],
        isSnippet: true,
      },
    });

    render(<SaveItemModal />);

    // Snippet specific title
    expect(screen.getByText('Save Code Snippet')).toBeInTheDocument();

    // Type selector tabs should NOT be visible (removed clutter)
    expect(screen.queryByRole('tab', { name: /web link/i })).not.toBeInTheDocument();

    // Snippet Title and Code labels
    expect(screen.getByLabelText(/snippet title/i)).toHaveValue('JAVASCRIPT Snippet: REST Endpoint');
    expect(screen.getByText('Snippet Code')).toBeInTheDocument();

    // Exactly ONE Copy button should exist in the snippet editor
    expect(screen.getAllByRole('button', { name: /copy/i }).length).toBe(1);

    // Tag pills should be visible
    expect(screen.getByText('snippet')).toBeInTheDocument();
    expect(screen.getAllByText('javascript').length).toBeGreaterThan(0);

    // Primary action button should say "Save Snippet"
    const saveBtn = screen.getByRole('button', { name: /save snippet/i });
    expect(saveBtn).toBeInTheDocument();

    fireEvent.click(saveBtn);
    expect(mockSaveItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'note',
        title: 'JAVASCRIPT Snippet: REST Endpoint',
        tags: expect.arrayContaining(['snippet', 'javascript']),
      }),
    );
  });

  it('supports AI suggestion flow for snippets', () => {
    useLibraryStore.setState({
      isAddModalOpen: true,
      addModalPrefill: {
        type: 'note',
        title: 'PY Snippet',
        content: '```python\ndef hello():\n    return "hi"\n```',
        tags: ['snippet', 'python'],
        isSnippet: true,
      },
    });

    render(<SaveItemModal />);

    const suggestBtn = screen.getByRole('button', { name: /ai suggest & tags/i });
    expect(suggestBtn).toBeInTheDocument();

    fireEvent.click(suggestBtn);
    expect(mockSuggestItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'note',
        suggestedTitle: 'PY Snippet',
        tags: expect.arrayContaining(['snippet', 'python']),
      }),
    );
  });
});

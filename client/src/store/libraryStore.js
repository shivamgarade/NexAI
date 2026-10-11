import { create } from 'zustand';
import { libraryApi } from '@/lib/api/library.api.js';
import { useAuthStore } from './authStore.js';
import { toast } from './uiStore.js';

export const useLibraryStore = create((set, get) => ({
  items: [],
  tags: [],
  activeTag: null,
  activeTab: 'all', // 'all' | 'notes_links' | 'documents' | 'files' | 'interviews'
  counts: {
    all: 0,
    notes_links: 0,
    documents: 0,
    files: 0,
    interviews: 0,
  },
  searchQuery: '',
  isLoading: false,
  isLoadingMore: false,
  isSearching: false,
  error: null,
  page: 1,
  totalPages: 1,
  total: 0,
  sortBy: 'createdAt',
  sortOrder: 'desc',

  // Add Note/Link / Suggest modal state
  isAddModalOpen: false,
  addModalPrefill: null,
  isSuggesting: false,
  suggestError: null,
  suggestion: null,
  isSaving: false,


  // Document Generator modal state
  isDocGenModalOpen: false,
  isGeneratingDoc: false,
  docGenError: null,
  docDraft: null,

  // File Uploader modal state
  isUploadModalOpen: false,
  isUploadingFile: false,

  // Document View / Preview modal state
  isViewDocModalOpen: false,
  viewingDoc: null,
  isExportingPdf: false,

  // Interview View / Scorecard modal state
  isViewInterviewModalOpen: false,
  viewingInterview: null,

  // Edit modal state
  isEditModalOpen: false,
  editingItem: null,
  isUpdating: false,

  // Item Detail View Modal state (comprehensive viewer for notes, links, docs, files, interviews)
  isViewItemModalOpen: false,
  viewingItem: null,

  // Delete dialog state
  isConfirmDeleteOpen: false,
  itemToDelete: null,
  isDeleting: false,

  /**
   * Fetches paginated library items, optionally filtering by active tag and tab.
   */
  fetchItems: async ({
    tag = get().activeTag,
    tab = get().activeTab,
    page = 1,
    append = false,
    sortBy = get().sortBy,
    sortOrder = get().sortOrder,
  } = {}) => {
    if (append) {
      set({ isLoadingMore: true, error: null });
    } else {
      set({ isLoading: true, error: null });
    }
    try {
      const params = { page, limit: 24, sortBy, sortOrder };
      if (tag) {
        params.tag = tag;
      }
      if (tab && tab !== 'all') {
        params.tab = tab;
      }
      const response = await libraryApi.getItems(params);
      const items = response.data || [];
      const meta = response.meta || {};

      set((state) => ({
        items: append ? [...state.items, ...items] : items,
        tags: meta.tags || state.tags,
        counts: meta.counts || state.counts,
        page: meta.page || page,
        totalPages: meta.totalPages || 1,
        total: meta.total !== undefined ? meta.total : items.length,
        isLoading: false,
        isLoadingMore: false,
        error: null,
      }));
      return items;
    } catch (err) {
      const message = err.message || 'Failed to load library items';
      set({ isLoading: false, isLoadingMore: false, error: message });
      toast.error(message);
      return [];
    }
  },

  /**
   * Sets sorting options and re-fetches items from page 1.
   */
  setSorting: ({ sortBy, sortOrder }) => {
    const newSortBy = sortBy !== undefined ? sortBy : get().sortBy;
    const newSortOrder = sortOrder !== undefined ? sortOrder : get().sortOrder;
    set({ sortBy: newSortBy, sortOrder: newSortOrder, page: 1 });
    get().fetchItems({ page: 1, sortBy: newSortBy, sortOrder: newSortOrder });
  },

  /**
   * Toggles pinned status for an item with optimistic updates.
   */
  togglePinItem: async (item) => {
    if (!item?._id) return;
    const nextPinned = !item.pinned;
    set((state) => ({
      items: state.items
        .map((it) => (it._id === item._id ? { ...it, pinned: nextPinned } : it))
        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)),
      viewingItem: state.viewingItem?._id === item._id ? { ...state.viewingItem, pinned: nextPinned } : state.viewingItem,
    }));
    try {
      await libraryApi.togglePin(item._id, nextPinned);
      toast.success(nextPinned ? 'Item pinned to top' : 'Item unpinned');
    } catch (err) {
      set((state) => ({
        items: state.items
          .map((it) => (it._id === item._id ? { ...it, pinned: item.pinned } : it))
          .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)),
        viewingItem: state.viewingItem?._id === item._id ? { ...state.viewingItem, pinned: item.pinned } : state.viewingItem,
      }));
      toast.error(err.message || 'Failed to update pin');
    }
  },

  /**
   * Loads the next page of items and appends to the current list.
   */
  loadMoreItems: async () => {
    const { page, totalPages, isLoadingMore, isLoading, isSearching, fetchItems } = get();
    if (isLoadingMore || isLoading || isSearching || page >= totalPages) return;
    return fetchItems({ page: page + 1, append: true });
  },

  /**
   * Changes active tab and fetches corresponding items.
   */
  setActiveTab: (tab) => {
    set({ activeTab: tab, activeTag: null, searchQuery: '', page: 1 });
    get().fetchItems({ tab, tag: null, page: 1 });
  },

  /**
   * Performs semantic search over library items.
   */
  searchItems: async (query) => {
    const trimmed = query?.trim() || '';
    set({ searchQuery: trimmed });

    if (!trimmed) {
      return get().fetchItems({ tag: get().activeTag, tab: get().activeTab });
    }

    set({ isSearching: true, error: null });
    try {
      const tab = get().activeTab;
      const response = await libraryApi.searchItems(trimmed, { tab });
      const items = response.data || [];
      set({ items, isSearching: false, error: null });
      return items;
    } catch (err) {
      const message = err.message || 'Search failed';
      set({ isSearching: false, error: message });
      toast.error(message);
      return [];
    }
  },

  /**
   * Sets active tag filter and refetches items.
   */
  setActiveTag: (tag) => {
    const newTag = get().activeTag === tag ? null : tag;
    set({ activeTag: newTag, searchQuery: '', page: 1 });
    get().fetchItems({ tag: newTag, tab: get().activeTab, page: 1 });
  },

  /**
   * Add / Suggest modal controls
   */
  openAddModal: (prefill = null) => {
    set({
      isAddModalOpen: true,
      addModalPrefill: prefill,
      isSuggesting: false,
      suggestError: null,
      suggestion: null,
      isSaving: false,
    });
  },

  closeAddModal: () => {
    set({
      isAddModalOpen: false,
      addModalPrefill: null,
      suggestion: null,
      suggestError: null,
      isSuggesting: false,
      isSaving: false,
    });
  },


  suggestItem: async ({ type, url, content, fileName }) => {
    set({ isSuggesting: true, suggestError: null });
    try {
      const response = await libraryApi.suggestItem({ type, url, content, fileName });
      const data = response.data;

      // Update credit balance in live auth store
      if (typeof data.creditsRemaining === 'number') {
        useAuthStore.getState().updateCredits(data.creditsRemaining);
      }

      set({
        suggestion: data,
        isSuggesting: false,
        suggestError: null,
      });
      return data;
    } catch (err) {
      const message = err.message || 'Failed to generate suggestion';
      set({ isSuggesting: false, suggestError: message });
      toast.error(message);
      throw err;
    }
  },

  /**
   * Saves confirmed item to MongoDB and vector DB (Confirm step).
   */
  saveItem: async (itemData) => {
    set({ isSaving: true });
    try {
      const response = await libraryApi.createItem(itemData);
      const newItem = response.data;

      set((state) => {
        const updatedTags = Array.from(new Set([...state.tags, ...(newItem.tags || [])])).sort();
        const updatedCounts = { ...state.counts, all: state.counts.all + 1 };
        if (newItem.type === 'document') updatedCounts.documents += 1;
        else if (newItem.type === 'file') updatedCounts.files += 1;
        else if (newItem.type === 'interview') updatedCounts.interviews += 1;
        else updatedCounts.notes_links += 1;

        return {
          items: [newItem, ...state.items],
          tags: updatedTags,
          counts: updatedCounts,
          total: state.total + 1,
          isSaving: false,
          isAddModalOpen: false,
          isDocGenModalOpen: false,
          isUploadModalOpen: false,
          suggestion: null,
          docDraft: null,
        };
      });

      toast.success('Saved to Library');
      return newItem;
    } catch (err) {
      const message = err.message || 'Failed to save item';
      set({ isSaving: false });
      toast.error(message);
      throw err;
    }
  },

  /**
   * Document Generator actions
   */
  openDocGenModal: () => {
    set({
      isDocGenModalOpen: true,
      isGeneratingDoc: false,
      docGenError: null,
      docDraft: null,
    });
  },

  closeDocGenModal: () => {
    set({
      isDocGenModalOpen: false,
      isGeneratingDoc: false,
      docGenError: null,
      docDraft: null,
    });
  },

  generateDocDraft: async ({ prompt, category }) => {
    set({ isGeneratingDoc: true, docGenError: null });
    try {
      const response = await libraryApi.generateDocumentDraft({ prompt, category });
      const data = response.data;

      // Update credit balance in live auth store
      if (typeof data.creditsRemaining === 'number') {
        useAuthStore.getState().updateCredits(data.creditsRemaining);
      }

      set({
        docDraft: data,
        isGeneratingDoc: false,
        docGenError: null,
      });
      return data;
    } catch (err) {
      const message = err.message || 'Failed to generate document draft';
      set({ isGeneratingDoc: false, docGenError: message });
      toast.error(message);
      throw err;
    }
  },

  updateDocDraft: (updater) => {
    set((state) => ({
      docDraft: typeof updater === 'function' ? updater(state.docDraft) : updater,
    }));
  },

  /**
   * File Uploader actions
   */
  openUploadModal: () => {
    set({ isUploadModalOpen: true, isUploadingFile: false });
  },

  closeUploadModal: () => {
    set({ isUploadModalOpen: false, isUploadingFile: false });
  },

  uploadFileItem: async (fileData) => {
    return get().saveItem({
      type: 'file',
      ...fileData,
    });
  },

  /**
   * Document View & Interview View actions (delegated to unified ItemDetailModal)
   */
  openViewDocModal: (item) => {
    get().openViewItemModal(item);
  },

  closeViewDocModal: () => {
    get().closeViewItemModal();
  },

  openViewInterviewModal: (item) => {
    get().openViewItemModal(item);
  },

  closeViewInterviewModal: () => {
    get().closeViewItemModal();
  },

  /**
   * Item Detail View Modal actions (unified viewer)
   */
  openViewItemModal: (item) => {
    set({ isViewItemModalOpen: true, viewingItem: item });
  },

  closeViewItemModal: () => {
    set({ isViewItemModalOpen: false, viewingItem: null });
  },

  exportPdf: async (item) => {
    if (!item?._id) return;
    set({ isExportingPdf: true });
    try {
      await libraryApi.exportDocumentPdf(item._id, item.title || 'document');
      toast.success('PDF download started');
    } catch (err) {
      const message = err.message || 'Failed to export PDF';
      toast.error(message);
    } finally {
      set({ isExportingPdf: false });
    }
  },

  /**
   * Edit item actions
   */
  openEditModal: (item) => {
    set({ isEditModalOpen: true, editingItem: item, isUpdating: false });
  },

  closeEditModal: () => {
    set({ isEditModalOpen: false, editingItem: null, isUpdating: false });
  },

  updateItem: async (id, itemData) => {
    set({ isUpdating: true });
    try {
      const response = await libraryApi.updateItem(id, itemData);
      const updated = response.data;

      set((state) => {
        const updatedItems = state.items.map((it) => (it._id === id ? updated : it));
        const updatedTags = Array.from(new Set([...state.tags, ...(updated.tags || [])])).sort();
        return {
          items: updatedItems,
          tags: updatedTags,
          viewingDoc: state.viewingDoc?._id === id ? updated : state.viewingDoc,
          viewingItem: state.viewingItem?._id === id ? updated : state.viewingItem,
          isUpdating: false,
          isEditModalOpen: false,
          editingItem: null,
        };
      });

      toast.success('Library item updated');
      return updated;
    } catch (err) {
      const message = err.message || 'Failed to update item';
      set({ isUpdating: false });
      toast.error(message);
      throw err;
    }
  },

  /**
   * Delete item actions
   */
  openDeleteDialog: (item) => {
    set({ isConfirmDeleteOpen: true, itemToDelete: item });
  },

  closeDeleteDialog: () => {
    set({ isConfirmDeleteOpen: false, itemToDelete: null, isDeleting: false });
  },

  confirmDeleteItem: async () => {
    const { itemToDelete } = get();
    if (!itemToDelete) return;

    set({ isDeleting: true });
    try {
      await libraryApi.deleteItem(itemToDelete._id);

      set((state) => {
        const updatedCounts = { ...state.counts, all: Math.max(0, state.counts.all - 1) };
        if (itemToDelete.type === 'document') {
          updatedCounts.documents = Math.max(0, updatedCounts.documents - 1);
        } else if (itemToDelete.type === 'file') {
          updatedCounts.files = Math.max(0, updatedCounts.files - 1);
        } else if (itemToDelete.type === 'interview') {
          updatedCounts.interviews = Math.max(0, updatedCounts.interviews - 1);
        } else {
          updatedCounts.notes_links = Math.max(0, updatedCounts.notes_links - 1);
        }

        return {
          items: state.items.filter((it) => it._id !== itemToDelete._id),
          counts: updatedCounts,
          total: Math.max(0, state.total - 1),
          isDeleting: false,
          isConfirmDeleteOpen: false,
          itemToDelete: null,
          isViewDocModalOpen: state.viewingDoc?._id === itemToDelete._id ? false : state.isViewDocModalOpen,
          viewingDoc: state.viewingDoc?._id === itemToDelete._id ? null : state.viewingDoc,
          isViewItemModalOpen: state.viewingItem?._id === itemToDelete._id ? false : state.isViewItemModalOpen,
          viewingItem: state.viewingItem?._id === itemToDelete._id ? null : state.viewingItem,
        };
      });

      toast.success('Library item deleted');
    } catch (err) {
      const message = err.message || 'Failed to delete item';
      set({ isDeleting: false });
      toast.error(message);
    }
  },
}));

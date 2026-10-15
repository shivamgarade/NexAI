import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Bookmark,
  RefreshCw,
  Sparkles,
  BookOpen,
  Paperclip,
  Mic,
  Upload,
  Layers,
  ChevronDown,
  X,
  ArrowUpDown,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchBar } from '@/components/common/SearchBar';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/store/uiStore';
import {
  LibraryCard,
  EditItemModal,
  DocGeneratorModal,
  FileUploaderModal,
  ItemDetailModal,
} from '@/features/library';

import { useLibraryStore } from '@/store/libraryStore';
import { useDebounce } from '@/hooks/useDebounce';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils/cn';
import { FilterPopover } from './FilterPopover';
import styles from './LibraryPage.module.scss';

const TABS = [
  { id: 'all', label: 'All Items', icon: <Layers size={15} /> },
  { id: 'notes_links', label: 'Notes & Links', icon: <Bookmark size={15} /> },
  { id: 'documents', label: 'Documents', icon: <BookOpen size={15} /> },
  { id: 'files', label: 'Files', icon: <Paperclip size={15} /> },
  { id: 'interviews', label: 'Interviews', icon: <Mic size={15} /> },
];

export default function LibraryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');

  const {
    items,
    tags,
    activeTag,
    activeTab,
    counts,
    isLoading,
    isLoadingMore,
    isSearching,
    error,
    page,
    totalPages,
    total,
    searchQuery,
    fetchItems,
    loadMoreItems,
    searchItems,
    setActiveTag,
    setActiveTab,
    openAddModal,
    openEditModal,
    openDocGenModal,
    openUploadModal,
    openViewItemModal,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDeleteItem,
    isConfirmDeleteOpen,
    itemToDelete,
    isDeleting,
    sortBy,
    sortOrder,
    setSorting,
    togglePinItem,
  } = useLibraryStore();

  const handleSendToChat = (item) => {
    let prefill = '';
    if (item.type === 'note') {
      prefill = item.content || item.summary || item.title;
    } else if (item.type === 'link') {
      prefill = item.url
        ? `Review this link: ${item.url}\n\nSummary: ${item.summary || ''}`
        : item.summary || item.title;
    } else if (item.type === 'document') {
      const sectionText = Array.isArray(item.sections)
        ? item.sections.map((s) => `## ${s.heading}\n\n${s.body}`).join('\n\n')
        : '';
      prefill = `# ${item.title}\n\n${sectionText || item.summary || ''}`;
    } else if (item.type === 'interview') {
      prefill = `MOCK INTERVIEW: ${item.title}\nOverall Score: ${item.scorecard?.overallScore ?? 0}/100\n\nSummary:\n${item.summary || item.scorecard?.feedback || ''}`;
    } else {
      prefill = `File Asset: ${item.fileName || item.title}\n${item.summary || ''}`;
    }

    navigate(ROUTES.CHAT, { state: { prefill } });
    toast.info('Item transferred to AI Chat');
  };

  const sortOptions = [
    { id: 'createdAt_desc', label: 'Newest First', sortBy: 'createdAt', sortOrder: 'desc' },
    { id: 'createdAt_asc', label: 'Oldest First', sortBy: 'createdAt', sortOrder: 'asc' },
    { id: 'title_asc', label: 'Title (A-Z)', sortBy: 'title', sortOrder: 'asc' },
    { id: 'title_desc', label: 'Title (Z-A)', sortBy: 'title', sortOrder: 'desc' },
    { id: 'score_desc', label: 'Highest Score', sortBy: 'score', sortOrder: 'desc' },
  ];

  const currentSortKey = `${sortBy}_${sortOrder}`;
  const sortLabel = sortOptions.find((o) => o.id === currentSortKey)?.label || 'Sort By';

  const sortDropdownItems = sortOptions.map((opt) => ({
    label: opt.label,
    onClick: () => setSorting({ sortBy: opt.sortBy, sortOrder: opt.sortOrder }),
  }));

  const [localSearch, setLocalSearch] = useState('');
  const debouncedSearch = useDebounce(localSearch, 350);

  // Sync tab with URL query parameter
  useEffect(() => {
    if (urlTab && TABS.some((t) => t.id === urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [urlTab, activeTab, setActiveTab]);

  // Initial load
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Reactive semantic search on debounced input
  useEffect(() => {
    searchItems(debouncedSearch);
  }, [debouncedSearch, searchItems]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setLocalSearch('');
    if (tabId === 'all') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', tabId);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const handleClearSearch = () => {
    setLocalSearch('');
    searchItems('');
  };

  const isSearchActive = Boolean(debouncedSearch.trim());

  // Helper for empty state content based on active tab
  const getEmptyStateDetails = () => {
    if (isSearchActive) {
      return {
        title: `No items found matching "${debouncedSearch}"`,
        description: 'Try different keywords or concepts. Semantic search matches meaning across summaries and content.',
        action: (
          <Button variant="secondary" onClick={handleClearSearch}>
            Clear Search
          </Button>
        ),
      };
    }

    if (activeTag) {
      return {
        title: `No items tagged #${activeTag}`,
        description: 'Try selecting another tag or view all saved items.',
        action: (
          <Button variant="secondary" onClick={() => setActiveTag(null)}>
            Show All Items
          </Button>
        ),
      };
    }

    switch (activeTab) {
      case 'documents':
        return {
          icon: <BookOpen size={32} />,
          title: 'No structured documents yet',
          description: 'Draft structured resumes, reports, and study notes with AI assistance and export them directly to PDF.',
          action: (
            <Button variant="primary" onClick={openDocGenModal} leftIcon={<Sparkles size={16} />}>
              Create First Document
            </Button>
          ),
        };
      case 'files':
        return {
          icon: <Paperclip size={32} />,
          title: 'No files uploaded',
          description: 'Upload markdown notes, text files, JSON, CSV, or PDFs to your personal library.',
          action: (
            <Button variant="primary" onClick={openUploadModal} leftIcon={<Upload size={16} />}>
              Upload a File
            </Button>
          ),
        };
      case 'interviews':
        return {
          icon: <Mic size={32} />,
          title: 'No interview sessions archived',
          description: 'Completed mock technical interviews and viva scorecards will automatically be archived here.',
          action: (
            <Button variant="primary" onClick={() => navigate(ROUTES.INTERVIEW)} leftIcon={<Mic size={16} />}>
              Start Mock Interview
            </Button>
          ),
        };
      case 'notes_links':
        return {
          icon: <Bookmark size={32} />,
          title: 'No notes or links saved',
          description: 'Save articles, documentation, or personal notes with AI-generated summaries and auto-tags.',
          action: (
            <Button variant="primary" onClick={openAddModal} leftIcon={<Plus size={16} />}>
              Add Note or Link
            </Button>
          ),
        };
      default:
        return {
          icon: <Layers size={32} />,
          title: 'Your Knowledge Hub is empty',
          description: 'Save bookmarks, notes, files, or generate structured documents with instant PDF export.',
          action: (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" onClick={openDocGenModal} leftIcon={<Sparkles size={16} />}>
                New Document
              </Button>
              <Button variant="primary" onClick={openAddModal} leftIcon={<Plus size={16} />}>
                Add Note / Link
              </Button>
            </div>
          ),
        };
    }
  };

  const emptyDetails = getEmptyStateDetails();

  const actionDropdownItems = [
    {
      icon: <Plus size={15} />,
      label: 'Note or Link',
      onClick: openAddModal,
    },
    {
      icon: <Sparkles size={15} />,
      label: 'New AI Document',
      onClick: openDocGenModal,
    },
    {
      icon: <Upload size={15} />,
      label: 'Upload File',
      onClick: openUploadModal,
    },
    {
      icon: <Mic size={15} />,
      label: 'Mock interview',
      onClick: () => navigate(ROUTES.INTERVIEW),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Knowledge Hub & Library"
        description="Unified personal repository for notes, bookmarks, custom files, AI-generated documents, and interview transcripts."
        actions={
          <div className={styles.headerActions}>
            <Dropdown
              align="right"
              trigger={
                <Button
                  variant="primary"
                  leftIcon={<Plus size={16} />}
                  rightIcon={<ChevronDown size={14} />}
                  aria-label="Add new item"
                  title="Add new item"
                >
                  Add
                </Button>
              }
              items={actionDropdownItems}
            />
          </div>
        }
      />

      {/* Tabbed Content Filtering */}
      <div className={styles.tabNav} role="tablist">
        {TABS.map((tab) => {
          const count = counts?.[tab.id] ?? 0;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              type="button"
              className={cn(styles.tabBtn, isActive && styles.activeTab)}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {count > 0 && <span className={styles.tabCount}>{count}</span>}
            </button>
          );
        })}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchRow}>
          <div className={styles.searchWrapper}>
            <SearchBar
              value={localSearch}
              onChange={setLocalSearch}
              onClear={handleClearSearch}
              placeholder="Search by meaning or keywords across notes, documents, and files..."
            />
          </div>

          <Dropdown
            align="right"
            trigger={
              <Button
                variant="secondary"
                size="md"
                leftIcon={<ArrowUpDown size={14} />}
                rightIcon={<ChevronDown size={14} />}
                className={styles.sortBtn}
                title="Sort items"
                aria-label="Sort items"
              >
                {sortLabel}
              </Button>
            }
            items={sortDropdownItems}
          />

          {tags && tags.length > 0 && (
            <FilterPopover
              tags={tags}
              activeTag={activeTag}
              onSelectTag={setActiveTag}
            />
          )}
        </div>

        {/* Clean active tag indicator chip */}
        {activeTag && (
          <div className={styles.activeFilterRow}>
            <span className={styles.activeFilterLabel}>Active Filter:</span>
            <span className={styles.activeTagBadge}>
              #{activeTag}
              <button
                type="button"
                className={styles.activeTagRemoveBtn}
                onClick={() => setActiveTag(null)}
                aria-label="Remove filter"
                title="Remove filter"
              >
                <X size={12} />
              </button>
            </span>
          </div>
        )}

        {isSearchActive && (
          <div className={styles.semanticIndicator}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} className={styles.semanticQuery} />
              <span>
                Semantic search results for{' '}
                <span className={styles.semanticQuery}>&ldquo;{debouncedSearch}&rdquo;</span>
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClearSearch}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Loading Skeletons */}
      {(isLoading || isSearching) && items.length === 0 ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className={styles.skeletonCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Skeleton width={28} height={28} radius="sm" />
                <Skeleton width={60} height={18} radius="sm" />
              </div>
              <Skeleton width="80%" height={22} radius="sm" />
              <Skeleton width="100%" height={16} radius="sm" />
              <Skeleton width="90%" height={16} radius="sm" />
              <div style={{ marginTop: 'auto', display: 'flex', gap: '6px' }}>
                <Skeleton width={50} height={20} radius="full" />
                <Skeleton width={60} height={20} radius="full" />
              </div>
            </div>
          ))}
        </div>
      ) : error && items.length === 0 ? (
        /* Error State */
        <div className={styles.errorState}>
          <p className={styles.errorText}>{error}</p>
          <Button
            variant="secondary"
            onClick={() => fetchItems()}
            leftIcon={<RefreshCw size={16} />}
          >
            Retry Loading
          </Button>
        </div>
      ) : items.length === 0 ? (
        /* Empty State */
        <EmptyState
          icon={emptyDetails.icon || <Bookmark size={32} />}
          title={emptyDetails.title}
          description={emptyDetails.description}
          action={emptyDetails.action}
        />
      ) : (
        <>
          <div className={styles.grid}>
            {items.map((item) => (
              <LibraryCard
                key={item._id}
                item={item}
                activeTag={activeTag}
                onCardClick={openViewItemModal}
                onTagClick={(tag) => setActiveTag(tag)}
                onEdit={openEditModal}
                onDelete={openDeleteDialog}
                onTogglePin={togglePinItem}
                onSendToChat={handleSendToChat}
              />
            ))}
          </div>

          {page < totalPages && !searchQuery && (
            <div className={styles.loadMoreContainer}>
              <Button
                variant="secondary"
                size="md"
                onClick={loadMoreItems}
                disabled={isLoadingMore}
                className={styles.loadMoreBtn}
              >
                {isLoadingMore ? (
                  <>
                    <RefreshCw size={14} className={styles.spinIcon} />
                    <span>Loading more items...</span>
                  </>
                ) : (
                  <>
                    <span>Load More Items</span>
                    <span className={styles.pageCountHint}>
                      ({items.length} of {total})
                    </span>
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <EditItemModal />
      <DocGeneratorModal />
      <FileUploaderModal />
      <ItemDetailModal />


      {/* Delete Confirmation */}
      <ConfirmDialog
        open={isConfirmDeleteOpen}
        onClose={closeDeleteDialog}
        onConfirm={confirmDeleteItem}
        title="Delete Library Item"
        description={`Are you sure you want to delete "${itemToDelete?.title}"? This cannot be undone.`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete Item'}
        confirmVariant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

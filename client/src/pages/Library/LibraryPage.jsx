import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
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
  FileText,
  Zap,
  Terminal,
} from 'lucide-react';
import { WorkspaceHeader } from '@/components/common/WorkspaceHeader';
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

const PromptsPage = lazy(() => import('@/pages/Prompts/PromptsPage'));
const SkillsPage = lazy(() => import('@/pages/Skills/SkillsPage'));

const TABS = [
  { id: 'all', label: 'All Items', icon: <Layers size={15} /> },
  { id: 'notes', label: 'Notes & Docs', icon: <FileText size={15} /> },
  { id: 'files', label: 'Files & Media', icon: <Paperclip size={15} /> },
  { id: 'prompts', label: 'Prompt Vault', icon: <Terminal size={15} /> },
  { id: 'skills', label: 'Agent Skills', icon: <Zap size={15} /> },
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

  // Client-side pagination batch to prevent lagging or freeze when loading many items
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    setVisibleCount(12);
  }, [activeTab, debouncedSearch, activeTag]);

  const displayedItems = useMemo(() => {
    return items.slice(0, visibleCount);
  }, [items, visibleCount]);

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
      {/* Higher-Order Workspace Header: Unified Layout Skeleton */}
      <WorkspaceHeader
        titleIcon={<Bookmark size={15} />}
        titleText="Library"
        tabs={TABS.map((tab) => ({
          id: tab.id,
          label: tab.label,
          icon: tab.icon,
          count: counts?.[tab.id] ?? 0,
        }))}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        search={activeTab === 'prompts' || activeTab === 'skills' ? undefined : localSearch}
        onSearchChange={activeTab === 'prompts' || activeTab === 'skills' ? undefined : (e) => setLocalSearch(e.target.value)}
        onSearchClear={activeTab === 'prompts' || activeTab === 'skills' ? undefined : handleClearSearch}
        searchPlaceholder="Search notes, files, docs..."
        actions={
          activeTab === 'prompts' || activeTab === 'skills' ? null : (
            <>
              <Dropdown
                align="right"
                trigger={
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<ArrowUpDown size={13} />}
                    rightIcon={<ChevronDown size={12} />}
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

              <Dropdown
                align="right"
                trigger={
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus size={14} />}
                    rightIcon={<ChevronDown size={12} />}
                    aria-label="Add new item"
                    title="Add new item"
                  >
                    Add
                  </Button>
                }
                items={actionDropdownItems}
              />
            </>
          )
        }
        subFilters={
          activeTab === 'prompts' || activeTab === 'skills' ? null : (activeTag || isSearchActive) && (
            <div className={styles.filterBanner}>
              {activeTag && (
                <div className={styles.activeTagBadge}>
                  <span className={styles.activeTagText}>#{activeTag}</span>
                  <button
                    type="button"
                    className={styles.activeTagRemoveBtn}
                    onClick={() => setActiveTag(null)}
                    aria-label="Remove filter"
                  >
                    <X size={11} />
                  </button>
                </div>
              )}
              {isSearchActive && (
                <div className={styles.semanticIndicator}>
                  <Sparkles size={13} className={styles.semanticIcon} />
                  <span>
                    Semantic search for <span className={styles.semanticQuery}>&ldquo;{debouncedSearch}&rdquo;</span>
                  </span>
                  <button
                    type="button"
                    className={styles.clearSearchBtn}
                    onClick={handleClearSearch}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )
        }
      />

      {/* Tab Content: Prompts, Skills, or Knowledge Hub Items */}
      {activeTab === 'prompts' ? (
        <Suspense
          fallback={
            <div className={styles.grid}>
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className={styles.skeletonCard}>
                  <Skeleton width="60%" height={20} radius="sm" />
                  <Skeleton width="100%" height={14} radius="sm" />
                </div>
              ))}
            </div>
          }
        >
          <PromptsPage hideHeader />
        </Suspense>
      ) : activeTab === 'skills' ? (
        <Suspense
          fallback={
            <div className={styles.grid}>
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className={styles.skeletonCard}>
                  <Skeleton width="60%" height={20} radius="sm" />
                  <Skeleton width="100%" height={14} radius="sm" />
                </div>
              ))}
            </div>
          }
        >
          <SkillsPage hideHeader />
        </Suspense>
      ) : (isLoading || isSearching) && items.length === 0 ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className={styles.skeletonCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Skeleton width={24} height={24} radius="sm" />
                <Skeleton width={50} height={16} radius="sm" />
              </div>
              <Skeleton width="75%" height={18} radius="sm" />
              <Skeleton width="100%" height={14} radius="sm" />
              <Skeleton width="85%" height={14} radius="sm" />
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
            {displayedItems.map((item) => (
              <LibraryCard
                key={item._id}
                item={item}
                onCardClick={openViewItemModal}
                onEdit={openEditModal}
                onDelete={openDeleteDialog}
                onTogglePin={togglePinItem}
                onSendToChat={handleSendToChat}
              />
            ))}
          </div>

          {/* Pagination: Lazy batch loading */}
          {displayedItems.length < items.length ? (
            <div className={styles.loadMoreContainer}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setVisibleCount((prev) => prev + 12)}
                className={styles.loadMoreBtn}
              >
                <span>Show More Items</span>
                <span className={styles.pageCountHint}>
                  ({displayedItems.length} of {items.length})
                </span>
              </Button>
            </div>
          ) : page < totalPages && !searchQuery ? (
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
                    <span>Fetch More from Cloud</span>
                    <span className={styles.pageCountHint}>
                      ({items.length} of {total})
                    </span>
                  </>
                )}
              </Button>
            </div>
          ) : null}
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

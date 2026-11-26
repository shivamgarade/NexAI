import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Terminal,
  Plus,
  Search,
  Star,
  AlertCircle,
  RefreshCw,
  Sparkles,
  BookOpen,
  ChevronDown,
  Tag as TagIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { Dropdown } from '@/components/ui/Dropdown';
import { Tag } from '@/components/ui/Tag';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  PromptCard,
  PromptFormModal,
  VariableFillModal,
  PromptDetailModal,
} from '@/features/prompts';
import { usePromptStore } from '@/store/promptStore';
import { toast } from '@/store/uiStore';
import { ROUTES } from '@/constants/routes';
import { STARTER_PROMPTS, PROMPT_CATEGORIES } from '@/constants/starterPrompts';
import { cn } from '@/lib/utils/cn';
import styles from './PromptsPage.module.scss';

export default function PromptsPage({ hideHeader = false }) {
  const navigate = useNavigate();
  const {
    prompts,
    isLoading,
    error,
    fetchPrompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
    toggleFavorite,
  } = usePromptStore();

  const [activeTab, setActiveTab] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [activePromptForUse, setActivePromptForUse] = useState(null);
  const [detailPrompt, setDetailPrompt] = useState(null);
  const [deletingPrompt, setDeletingPrompt] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  // Extract all unique tags across both user prompts and starter templates
  const allTags = useMemo(() => {
    const tagsSet = new Set();
    prompts.forEach((p) => {
      (p.tags || []).forEach((t) => tagsSet.add(t));
    });
    STARTER_PROMPTS.forEach((p) => {
      (p.tags || []).forEach((t) => tagsSet.add(t));
    });
    return Array.from(tagsSet).sort();
  }, [prompts]);

  // Multi-tier filtering: View Tab -> Category -> Favorites -> Tags -> Search Query
  const filteredPrompts = useMemo(() => {
    let pool = [];
    if (activeTab === 'vault') {
      pool = prompts;
    } else if (activeTab === 'starters') {
      pool = STARTER_PROMPTS;
    } else {
      pool = [...prompts, ...STARTER_PROMPTS];
    }

    if (favoritesOnly) {
      pool = pool.filter((p) => p.isFavorite);
    }

    if (selectedCategory && selectedCategory !== 'all') {
      const cat = selectedCategory.toLowerCase();
      pool = pool.filter((p) => {
        if (p.category && p.category.toLowerCase() === cat) return true;
        return p.tags?.some((t) => t.toLowerCase().includes(cat));
      });
    }

    if (selectedTag) {
      pool = pool.filter((p) => p.tags?.includes(selectedTag));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      pool = pool.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          p.template.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q)),
      );
    }

    return pool;
  }, [prompts, activeTab, favoritesOnly, selectedCategory, selectedTag, search]);

  const handleOpenCreate = () => {
    setEditingPrompt(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (prompt) => {
    setEditingPrompt(prompt);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (promptData) => {
    if (editingPrompt) {
      await updatePrompt(editingPrompt._id, promptData);
    } else {
      await createPrompt(promptData);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingPrompt) return;
    setIsDeleting(true);
    await deletePrompt(deletingPrompt._id);
    setIsDeleting(false);
    setDeletingPrompt(null);
  };

  const handleCloneStarter = async (starterPrompt) => {
    const res = await createPrompt({
      title: starterPrompt.title,
      description: starterPrompt.description,
      template: starterPrompt.template,
      tags: starterPrompt.tags || [],
      isFavorite: false,
    });
    if (res) {
      toast.success(`Cloned "${starterPrompt.title}" to your vault`);
    }
  };

  const handleUsePromptInChat = (compiledPrompt) => {
    // Navigate to chat with compiled prompt pre-populated in state
    navigate(ROUTES.CHAT, { state: { prefill: compiledPrompt } });
  };

  const viewTabs = [
    {
      id: 'all',
      label: `All (${prompts.length + STARTER_PROMPTS.length})`,
      icon: <BookOpen size={14} />,
    },
    {
      id: 'vault',
      label: `My Vault (${prompts.length})`,
      icon: <Terminal size={14} />,
    },
    {
      id: 'starters',
      label: `Starter Hub (${STARTER_PROMPTS.length})`,
      icon: <Sparkles size={14} />,
    },
  ];

  return (
    <div className={styles.pageContainer} data-testid="prompts-page">
      {!hideHeader && (
        <PageHeader
          title="Prompt Vault"
          description="Reusable, variable-driven prompt templates with one-click filling and instant chat injection."
          actions={
            <Button
              variant="primary"
              leftIcon={<Plus size={16} />}
              onClick={handleOpenCreate}
            >
              New Prompt
            </Button>
          }
        />
      )}

      {/* Top View Selector Tabs */}
      <div className={styles.viewTabsRow}>
        <Tabs
          items={viewTabs}
          value={activeTab}
          onChange={setActiveTab}
          className={styles.viewTabs}
        />
      </div>

      {/* Toolbar: Search input, category filter, tag filters, favorite toggle */}
      <div className={styles.toolbar}>
        <div className={styles.searchRow}>
          <div className={styles.searchWrapper}>
            <Input
              leftIcon={<Search size={16} />}
              placeholder="Search prompts by title, description, or tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.quickFilters}>
            <button
              type="button"
              className={cn(styles.filterPill, favoritesOnly && styles.activePill)}
              onClick={() => setFavoritesOnly(!favoritesOnly)}
              aria-pressed={favoritesOnly}
            >
              <Star size={14} fill={favoritesOnly ? 'currentColor' : 'none'} />
              <span>Favorites</span>
            </button>

            {allTags.length > 0 && (
              <Dropdown
                trigger={
                  <button
                    type="button"
                    className={cn(styles.filterPill, selectedTag && styles.activePill)}
                    aria-label="Filter by tag"
                  >
                    <TagIcon size={13} />
                    <span>{selectedTag ? `#${selectedTag}` : 'Tags'}</span>
                    <ChevronDown size={13} />
                  </button>
                }
                items={[
                  {
                    label: 'All Tags (Reset)',
                    onClick: () => setSelectedTag(null),
                    active: selectedTag === null,
                  },
                  { divider: true },
                  ...allTags.map((tag) => ({
                    label: `#${tag}`,
                    onClick: () => setSelectedTag(selectedTag === tag ? null : tag),
                    active: selectedTag === tag,
                  })),
                ]}
                align="right"
              />
            )}
          </div>
        </div>

        {/* Category Pills & Active Tag Filter */}
        <div className={styles.categoriesRow}>
          <div className={styles.categoryPills}>
            {PROMPT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={cn(styles.filterPill, selectedCategory === cat.id && styles.activePill)}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {selectedTag && (
            <div className={styles.activeTagChip}>
              <Tag
                label={`#${selectedTag}`}
                removable
                onRemove={() => setSelectedTag(null)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Content Area with 4 UX states */}
      <div className={styles.contentArea}>
        {isLoading && prompts.length === 0 ? (
          <div className={styles.skeletonGrid} data-testid="prompts-skeleton">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard}>
                <Skeleton height="24px" width="60%" radius="md" />
                <Skeleton height="16px" width="90%" radius="sm" />
                <Skeleton height="32px" width="40%" radius="sm" />
              </div>
            ))}
          </div>
        ) : error && prompts.length === 0 ? (
          <div className={styles.errorBox} role="alert">
            <AlertCircle size={28} className={styles.errorIcon} />
            <p className={styles.errorMessage}>{error}</p>
            <Button
              variant="secondary"
              leftIcon={<RefreshCw size={14} />}
              onClick={() => fetchPrompts()}
            >
              Try Again
            </Button>
          </div>
        ) : filteredPrompts.length === 0 ? (
          <EmptyState
            icon={<Terminal size={32} />}
            title={activeTab === 'vault' && prompts.length === 0 ? 'Your personal vault is empty' : 'No matching prompts'}
            description={
              activeTab === 'vault' && prompts.length === 0
                ? 'Save your own custom prompt templates with {{variables}}, or save any curated starter template to your vault.'
                : 'No prompts found matching your current category, search, or tag filters.'
            }
            action={
              activeTab === 'vault' && prompts.length === 0 ? (
                <div className={styles.emptyActions}>
                  <Button
                    variant="primary"
                    leftIcon={<Plus size={16} />}
                    onClick={handleOpenCreate}
                  >
                    Create First Prompt
                  </Button>
                  <Button
                    variant="secondary"
                    leftIcon={<Sparkles size={16} />}
                    onClick={() => setActiveTab('starters')}
                  >
                    Explore Starter Hub
                  </Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setSelectedTag(null);
                    setSelectedCategory('all');
                    setFavoritesOnly(false);
                  }}
                >
                  Clear Filters
                </Button>
              )
            }
          />
        ) : (
          <div className={styles.grid}>
            {filteredPrompts.map((prompt) => (
              <PromptCard
                key={prompt._id}
                prompt={prompt}
                onUse={(p) => setActivePromptForUse(p)}
                onEdit={(p) => handleOpenEdit(p)}
                onDelete={(p) => setDeletingPrompt(p)}
                onToggleFavorite={(id) => toggleFavorite(id)}
                onClone={handleCloneStarter}
                onViewDetails={(p) => setDetailPrompt(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal when a prompt card is clicked */}
      {detailPrompt && (
        <PromptDetailModal
          open={Boolean(detailPrompt)}
          onClose={() => setDetailPrompt(null)}
          prompt={detailPrompt}
          onUse={(p) => setActivePromptForUse(p)}
          onEdit={(p) => handleOpenEdit(p)}
          onDelete={(p) => setDeletingPrompt(p)}
          onToggleFavorite={(id) => {
            toggleFavorite(id);
            setDetailPrompt((prev) =>
              prev && prev._id === id ? { ...prev, isFavorite: !prev.isFavorite } : prev,
            );
          }}
          onClone={handleCloneStarter}
        />
      )}

      {/* Form Modal for Creating & Editing */}
      <PromptFormModal
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        initialData={editingPrompt}
        onSubmit={handleFormSubmit}
      />

      {/* Variable Fill Modal when "Use Prompt" is triggered */}
      {activePromptForUse && (
        <VariableFillModal
          open={Boolean(activePromptForUse)}
          onClose={() => setActivePromptForUse(null)}
          prompt={activePromptForUse}
          onConfirm={handleUsePromptInChat}
          actionLabel="Use in Chat"
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingPrompt)}
        title="Delete Prompt"
        description={`Are you sure you want to delete "${deletingPrompt?.title}"? This action cannot be undone.`}
        confirmLabel="Delete Prompt"
        tone="danger"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingPrompt(null)}
      />
    </div>
  );
}

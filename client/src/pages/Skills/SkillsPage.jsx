import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap,
  Plus,
  Search,
  Star,
  Sparkles,
  BookOpen,
  Filter,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  SkillCard,
  SkillFormModal,
  SkillDetailModal,
  VariableFillModal,
} from '@/features/skills';
import { useSkillStore } from '@/store/skillStore';
import { useChatStore } from '@/store/chatStore';
import { toast } from '@/store/uiStore';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils/cn';
import styles from './SkillsPage.module.scss';

const CATEGORIES = ['All', 'Research', 'Coding', 'Writing', 'Analysis', 'Productivity', 'General'];

export default function SkillsPage() {
  const navigate = useNavigate();
  const {
    skills,
    isLoading,
    fetchSkills,
    createSkill,
    updateSkill,
    deleteSkill,
    toggleFavorite,
    setActiveSkill,
  } = useSkillStore();

  const { createChat } = useChatStore();

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'system' | 'custom' | 'favorites'
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [detailSkill, setDetailSkill] = useState(null);
  const [activeSkillForVariables, setActiveSkillForVariables] = useState(null);
  const [deletingSkill, setDeletingSkill] = useState(null);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const filteredSkills = useMemo(() => {
    let pool = skills;

    if (activeTab === 'system') {
      pool = pool.filter((s) => s.isSystem);
    } else if (activeTab === 'custom') {
      pool = pool.filter((s) => !s.isSystem);
    } else if (activeTab === 'favorites') {
      pool = pool.filter((s) => s.isFavorite);
    }

    if (selectedCategory !== 'All') {
      pool = pool.filter((s) => s.category?.toLowerCase() === selectedCategory.toLowerCase());
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      pool = pool.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.tools?.some((t) => t.toLowerCase().includes(q)) ||
          s.tags?.some((t) => t.toLowerCase().includes(q)),
      );
    }

    return pool;
  }, [skills, activeTab, selectedCategory, search]);

  const handleUseSkill = (skill) => {
    // If skill has variables, open variable fill modal first
    if (Array.isArray(skill.variables) && skill.variables.length > 0) {
      setActiveSkillForVariables(skill);
      return;
    }

    // Direct run: set as active skill in store and open chat
    setActiveSkill(skill);
    navigate(ROUTES.CHAT);
  };

  const handleRunCompiledSkill = (compiledInstructions) => {
    if (activeSkillForVariables) {
      setActiveSkill({
        ...activeSkillForVariables,
        instructions: compiledInstructions,
      });
    }
    setActiveSkillForVariables(null);
    navigate(ROUTES.CHAT);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSkill) return;
    try {
      await deleteSkill(deletingSkill._id);
      setDeletingSkill(null);
    } catch {
      // Handled in store
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="AI Skills & Agentic Tools"
        description="Autonomous agent capabilities equipped with live web search, deep link analysis, sandboxed code execution, and workspace retrieval."
        icon={<Zap size={22} />}
        actions={
          <Button
            variant="primary"
            leftIcon={<Plus size={16} />}
            onClick={() => {
              setEditingSkill(null);
              setIsFormOpen(true);
            }}
          >
            Create Skill
          </Button>
        }
      />

      <div className={styles.controlsBar}>
        <div className={styles.topRow}>
          <Tabs
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: 'all', label: `All Skills (${skills.length})` },
              { id: 'system', label: 'Built-in Systems' },
              { id: 'custom', label: 'My Skills' },
              { id: 'favorites', label: 'Favorites' },
            ]}
          />

          <div className={styles.searchWrapper}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search skills, tools, or tags..."
              leftIcon={<Search size={15} />}
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className={styles.categoryChips}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={cn(styles.categoryChip, selectedCategory === cat && styles.active)}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loadingGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className={styles.skeletonCard} />
          ))}
        </div>
      ) : filteredSkills.length === 0 ? (
        <EmptyState
          icon={<Zap size={32} />}
          title="No skills found"
          description={
            search || selectedCategory !== 'All'
              ? 'Try adjusting your search terms or category filters.'
              : 'Create your first custom AI agent skill with specialized instructions and tools.'
          }
          action={
            <Button
              variant="primary"
              leftIcon={<Plus size={15} />}
              onClick={() => {
                setEditingSkill(null);
                setIsFormOpen(true);
              }}
            >
              Create New Skill
            </Button>
          }
        />
      ) : (
        <div className={styles.grid}>
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill._id}
              skill={skill}
              onUse={handleUseSkill}
              onEdit={(s) => {
                setEditingSkill(s);
                setIsFormOpen(true);
              }}
              onDelete={(s) => setDeletingSkill(s)}
              onToggleFavorite={toggleFavorite}
              onViewDetails={(s) => setDetailSkill(s)}
            />
          ))}
        </div>
      )}

      {/* Form Modal (Create / Edit) */}
      <SkillFormModal
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingSkill(null);
        }}
        initialData={editingSkill}
        onSubmit={async (data) => {
          if (editingSkill) {
            await updateSkill(editingSkill._id, data);
          } else {
            await createSkill(data);
          }
        }}
      />

      {/* Detail Inspection Modal */}
      <SkillDetailModal
        open={Boolean(detailSkill)}
        onClose={() => setDetailSkill(null)}
        skill={detailSkill}
        onUse={handleUseSkill}
      />

      {/* Variable Fill Modal */}
      {activeSkillForVariables && (
        <VariableFillModal
          open={Boolean(activeSkillForVariables)}
          onClose={() => setActiveSkillForVariables(null)}
          prompt={{
            ...activeSkillForVariables,
            template: activeSkillForVariables.instructions || activeSkillForVariables.template,
          }}
          onInsert={handleRunCompiledSkill}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingSkill)}
        title="Delete AI Skill"
        message={`Are you sure you want to delete "${deletingSkill?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingSkill(null)}
      />
    </div>
  );
}

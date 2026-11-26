import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Zap,
  Plus,
  Search,
  Sparkles,
  Terminal,
  Clock,
  Layers,
  Sliders,
  Menu,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
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
import { SchedulesTab } from '@/features/automations/SchedulesTab';
import { ConnectedAppsTab } from '@/features/automations/ConnectedAppsTab';
import PromptsPage from '@/pages/Prompts/PromptsPage';
import { useSkillStore } from '@/store/skillStore';
import { useChatStore } from '@/store/chatStore';
import { useScheduleStore } from '@/store/scheduleStore';
import { useConnectedAppStore } from '@/store/connectedAppStore';
import { useUiStore } from '@/store/uiStore';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils/cn';
import styles from './SkillsPage.module.scss';

const CATEGORIES = ['All', 'Research', 'Coding', 'Writing', 'Analysis', 'Productivity', 'General'];

const PRIMARY_TABS = [
  { id: 'skills', label: 'Agent Skills', icon: <Zap size={15} /> },
  { id: 'prompts', label: 'Prompt Vault', icon: <Terminal size={15} /> },
  { id: 'automations', label: 'Automations', icon: <Clock size={15} /> },
];

export default function SkillsPage() {
  const navigate = useNavigate();
  const setDrawerOpen = useUiStore((state) => state.setDrawerOpen);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'skills';

  const [activePrimaryTab, setActivePrimaryTab] = useState(
    ['skills', 'prompts', 'automations', 'schedules'].includes(initialTab)
      ? initialTab === 'schedules' ? 'automations' : initialTab
      : 'skills',
  );

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

  const { schedules, fetchSchedules } = useScheduleStore();
  const { apps, fetchConnectedApps } = useConnectedAppStore();

  const [activeSubTab, setActiveSubTab] = useState('all'); // 'all' | 'system' | 'custom' | 'favorites'
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');

  // Modals for Skills
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [detailSkill, setDetailSkill] = useState(null);
  const [activeSkillForVariables, setActiveSkillForVariables] = useState(null);
  const [deletingSkill, setDeletingSkill] = useState(null);

  // Sync tab from URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['skills', 'prompts', 'automations', 'schedules'].includes(tab)) {
      setActivePrimaryTab(tab === 'schedules' ? 'automations' : tab);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchSkills();
    fetchSchedules();
    fetchConnectedApps();
  }, [fetchSkills, fetchSchedules, fetchConnectedApps]);

  const handleTabChange = (newTab) => {
    setActivePrimaryTab(newTab);
    setSearchParams({ tab: newTab });
  };

  const filteredSkills = useMemo(() => {
    let pool = skills;

    if (activeSubTab === 'system') {
      pool = pool.filter((s) => s.isSystem);
    } else if (activeSubTab === 'custom') {
      pool = pool.filter((s) => !s.isSystem);
    } else if (activeSubTab === 'favorites') {
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
  }, [skills, activeSubTab, selectedCategory, search]);

  const handleUseSkill = (skill) => {
    if (Array.isArray(skill.variables) && skill.variables.length > 0) {
      setActiveSkillForVariables(skill);
      return;
    }
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
      {/* Pinned Sticky Command Header: Compact, Minimal, Zero Bloat */}
      <header className={styles.stickyHeader}>
        <div className={styles.commandRow}>
          {/* Left: Mobile Menu + Studio Title + Primary Segmented Tabs */}
          <div className={styles.navLeft}>
            <div className={styles.mobileMenuBtn}>
              <IconButton
                icon={<Menu size={18} />}
                label="Open menu"
                size="sm"
                variant="ghost"
                onClick={() => setDrawerOpen(true)}
              />
            </div>

            <div className={styles.titleBadge}>
              <Zap size={15} className={styles.titleIcon} />
              <span className={styles.titleText}>Studio</span>
            </div>

            <div className={styles.segmentedTabs} role="tablist">
              {PRIMARY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activePrimaryTab === tab.id}
                  className={cn(
                    styles.segmentedTabBtn,
                    activePrimaryTab === tab.id && styles.segmentedTabActive,
                  )}
                  onClick={() => handleTabChange(tab.id)}
                >
                  <span className={styles.tabIcon}>{tab.icon}</span>
                  <span className={styles.tabLabel}>{tab.label}</span>
                  {tab.id === 'skills' && skills.length > 0 && (
                    <span className={styles.tabBadge}>{skills.length}</span>
                  )}
                  {tab.id === 'automations' && schedules.length > 0 && (
                    <span className={styles.tabBadge}>{schedules.length}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Search & Create Action */}
          {activePrimaryTab === 'skills' && (
            <div className={styles.actionsGroup}>
              <div className={styles.searchWrapper}>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search skills or tools..."
                  size="sm"
                  leftIcon={<Search size={14} />}
                  rightIcon={
                    search ? (
                      <X
                        size={13}
                        className={styles.clearIcon}
                        onClick={() => setSearch('')}
                        style={{ cursor: 'pointer' }}
                      />
                    ) : null
                  }
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => {
                  setEditingSkill(null);
                  setIsFormOpen(true);
                }}
              >
                Create Skill
              </Button>
            </div>
          )}
        </div>

        {/* Sub-Filter Strip (Only on Skills tab) */}
        {activePrimaryTab === 'skills' && (
          <div className={styles.subFilterRow}>
            <div className={styles.subTabs}>
              {[
                { id: 'all', label: `All (${skills.length})` },
                { id: 'system', label: 'Built-in' },
                { id: 'custom', label: 'Custom' },
                { id: 'favorites', label: 'Favorites' },
              ].map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  className={cn(styles.subTabBtn, activeSubTab === sub.id && styles.activeSubTab)}
                  onClick={() => setActiveSubTab(sub.id)}
                >
                  {sub.label}
                </button>
              ))}
            </div>

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
        )}
      </header>

      {/* Tab 1: Agent Skills Content */}
      {activePrimaryTab === 'skills' && (
        <div className={styles.tabContent}>

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
        </div>
      )}

      {/* Tab 2: Prompt Vault */}
      {activePrimaryTab === 'prompts' && (
        <div className={styles.embeddedTabWrapper}>
          <PromptsPage hideHeader />
        </div>
      )}

      {/* Tab 3: Automations & Schedules */}
      {activePrimaryTab === 'automations' && (
        <div className={styles.automationsWrapper}>
          <div className={styles.automationsSubTabs}>
            <SchedulesTab />
            <div style={{ marginTop: 'var(--space-6)' }}>
              <ConnectedAppsTab />
            </div>
          </div>
        </div>
      )}

      {/* Form Modal (Create / Edit Skill) */}
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

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  Upload,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  SkillCard,
  SkillFormModal,
  SkillDetailModal,
  VariableFillModal,
} from '@/features/skills';
import { useSkillStore } from '@/store/skillStore';
import { toast } from '@/store/uiStore';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils/cn';
import styles from './SkillsTab.module.scss';

const CATEGORIES = ['All', 'Research', 'Coding', 'Writing', 'Analysis', 'Productivity', 'General'];

const RECOMMENDED_SKILLS = [
  {
    title: 'Match your writing style',
    description: 'Learns your voice from your real writing across Workspace apps',
    category: 'Writing',
    icon: 'PenTool',
    tools: ['workspace_search'],
    instructions:
      'Always-on skill that ensures every piece of writing sounds like the user. Analyzes tone, sentence length, vocabulary quirks, and style registers. Adapts to emails, memos, summaries, announcements, and proposals without needing to ask.',
  },
  {
    title: 'Focus your energy',
    description: 'Align your workload with your energy instead of your calendar',
    category: 'Productivity',
    icon: 'Zap',
    tools: ['workspace_search'],
    instructions:
      'Prioritizes and restructures tasks by cognitive demand, peak mental energy intervals, and contextual deep-work blocks rather than rigid calendar blocks.',
  },
  {
    title: 'Get more perspectives',
    description: 'Get 3–5 distinct viewpoints before you commit to a decision',
    category: 'Analysis',
    icon: 'Layers',
    tools: ['web_search'],
    instructions:
      'Analyzes decisions, system architectures, or proposals by contrasting multiple distinct senior viewpoints (e.g. Staff Architect, Devil\'s Advocate, Product VP, and Security Auditor).',
  },
  {
    title: 'Generate fresh ideas',
    description: 'Turn existing content into 5 entirely new creative concepts',
    category: 'Writing',
    icon: 'Sparkles',
    tools: ['web_search'],
    instructions:
      'Transforms existing technical or domain materials into 5 entirely novel, unorthodox concepts, reframing assumptions and cross-pollinating concepts across adjacent domains.',
  },
  {
    title: 'Code Refactoring & Complexity Reducer',
    description: 'Identifies deep cyclomatic complexity and simplifies codebases into modular units',
    category: 'Coding',
    icon: 'Code2',
    tools: ['code_execution', 'web_search'],
    instructions:
      'Pinpoints high-cyclomatic complexity code blocks, breaks them down into pure modular functions, and generates comprehensive test cases.',
  },
  {
    title: 'Executive Brief & Strategy Synthesizer',
    description: 'Distills multi-page documents and meeting notes into crisp 1-page executive memos',
    category: 'Writing',
    icon: 'PenTool',
    tools: ['web_search', 'workspace_search'],
    instructions:
      'Analyzes project documents and web insights to draft high-impact executive summaries with structured decisions, rationale, and next steps.',
  },
];

export function SkillsTab() {
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

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'system' | 'custom' | 'favorites'
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [showAllRecommended, setShowAllRecommended] = useState(false);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [detailSkill, setDetailSkill] = useState(null);
  const [activeSkillForVariables, setActiveSkillForVariables] = useState(null);
  const [deletingSkill, setDeletingSkill] = useState(null);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const displayedRecommended = useMemo(() => {
    return showAllRecommended ? RECOMMENDED_SKILLS : RECOMMENDED_SKILLS.slice(0, 4);
  }, [showAllRecommended]);

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
    if (Array.isArray(skill.variables) && skill.variables.length > 0) {
      setActiveSkillForVariables(skill);
      return;
    }

    setActiveSkill(skill);
    toast.info(`Active skill set: ${skill.title}`);
    navigate(ROUTES.CHAT);
  };

  const handleConfirmVariables = async (finalInstructions) => {
    if (activeSkillForVariables) {
      setActiveSkill({
        ...activeSkillForVariables,
        instructions: finalInstructions,
      });
      toast.info(`Active skill set: ${activeSkillForVariables.title}`);
      navigate(ROUTES.CHAT);
    }
    setActiveSkillForVariables(null);
  };

  const handleApplyRecommended = (preset) => {
    setEditingSkill(preset);
    setIsFormOpen(true);
  };

  const handleCreateWithGemini = () => {
    setEditingSkill({
      title: 'Full-Stack Performance Auditor',
      description: 'Audits frontend and backend bottlenecks and advises optimizations',
      category: 'Coding',
      icon: 'Cpu',
      tools: ['code_execution', 'web_search'],
      instructions:
        'You are an expert Performance Engineer. Audit full-stack systems for render jank, memory leaks, query overhead, and slow TTFB. Deliver prioritized, measurable recommendations.',
    });
    setIsFormOpen(true);
  };

  return (
    <div className={styles.container}>
      {/* Google Gemini Skills Header (matching Screenshot 5) */}
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Skills</h1>
          <p className={styles.subtitle}>
            Create custom, reusable instructions for more helpful responses. Gemini uses relevant skills automatically, or you can apply them using <span className={styles.slashBadge}>/</span>.{' '}
            <span className={styles.learnMore}>Learn more</span>
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.geminiPillBtn}
            onClick={handleCreateWithGemini}
          >
            <Sparkles size={15} />
            <span>Create with Gemini</span>
          </button>
          <button
            type="button"
            className={styles.manualPillBtn}
            onClick={() => {
              setEditingSkill(null);
              setIsFormOpen(true);
            }}
          >
            <Plus size={15} />
            <span>Create manually</span>
          </button>
          <button
            type="button"
            className={styles.iconUploadBtn}
            onClick={() => {
              setEditingSkill(null);
              setIsFormOpen(true);
            }}
            title="Upload or import custom skill"
          >
            <Upload size={15} />
          </button>
        </div>
      </div>

      {/* Recommended Section (matching Screenshot 5: stacked list of cards) */}
      <div className={styles.recommendedSection}>
        <h2 className={styles.sectionHeading}>Recommended</h2>
        <div className={styles.recommendedList}>
          {displayedRecommended.map((rec) => (
            <div
              key={rec.title}
              className={styles.recommendedItem}
              onClick={() => handleApplyRecommended(rec)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplyRecommended(rec);
              }}
            >
              <h3 className={styles.recTitle}>{rec.title}</h3>
              <p className={styles.recDesc}>{rec.description}</p>
            </div>
          ))}
        </div>

        <div className={styles.showMoreRow}>
          <button
            type="button"
            className={styles.showMoreBtn}
            onClick={() => setShowAllRecommended((prev) => !prev)}
          >
            <span>{showAllRecommended ? 'Show less' : 'Show more'}</span>
            {showAllRecommended ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={styles.filterBar}>
        <div className={styles.tabFilters}>
          <button
            type="button"
            className={cn(styles.filterTab, activeTab === 'all' && styles.filterTabActive)}
            onClick={() => setActiveTab('all')}
          >
            All Skills
          </button>
          <button
            type="button"
            className={cn(styles.filterTab, activeTab === 'system' && styles.filterTabActive)}
            onClick={() => setActiveTab('system')}
          >
            System Built-in
          </button>
          <button
            type="button"
            className={cn(styles.filterTab, activeTab === 'custom' && styles.filterTabActive)}
            onClick={() => setActiveTab('custom')}
          >
            My Custom
          </button>
          <button
            type="button"
            className={cn(styles.filterTab, activeTab === 'favorites' && styles.filterTabActive)}
            onClick={() => setActiveTab('favorites')}
          >
            Favorites
          </button>
        </div>

        <div className={styles.searchBox}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search skills, tools, tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className={styles.categoriesRow}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={cn(styles.categoryPill, selectedCategory === cat && styles.categoryPillActive)}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Skills Grid */}
      {isLoading && skills.length === 0 ? (
        <div className={styles.skillsGrid}>
          <Skeleton height={180} />
          <Skeleton height={180} />
          <Skeleton height={180} />
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className={styles.emptyWrap}>
          <p className={styles.emptyText}>No skills found matching your filters.</p>
        </div>
      ) : (
        <div className={styles.skillsGrid}>
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill._id || skill.slug}
              skill={skill}
              onUse={handleUseSkill}
              onEdit={(s) => {
                setEditingSkill(s);
                setIsFormOpen(true);
              }}
              onDelete={(s) => setDeletingSkill(s)}
              onToggleFavorite={toggleFavorite}
              onClick={(s) => setDetailSkill(s)}
            />
          ))}
        </div>
      )}

      {/* Form Modal */}
      <SkillFormModal
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingSkill(null);
        }}
        initialSkill={editingSkill}
        onSubmit={async (data) => {
          if (editingSkill?._id) {
            await updateSkill(editingSkill._id, data);
          } else {
            await createSkill(data);
          }
          setIsFormOpen(false);
          setEditingSkill(null);
        }}
      />

      {/* Detail Modal */}
      <SkillDetailModal
        skill={detailSkill}
        open={Boolean(detailSkill)}
        onClose={() => setDetailSkill(null)}
        onUse={(s) => {
          setDetailSkill(null);
          handleUseSkill(s);
        }}
        onEdit={(s) => {
          setDetailSkill(null);
          setEditingSkill(s);
          setIsFormOpen(true);
        }}
      />

      {/* Variable Fill Modal */}
      {activeSkillForVariables && (
        <VariableFillModal
          open={Boolean(activeSkillForVariables)}
          onClose={() => setActiveSkillForVariables(null)}
          onConfirm={handleConfirmVariables}
          template={activeSkillForVariables.instructions}
          variables={activeSkillForVariables.variables}
          title={activeSkillForVariables.title}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={Boolean(deletingSkill)}
        title="Delete Skill?"
        message={`Are you sure you want to delete "${deletingSkill?.title}"?`}
        confirmText="Delete"
        variant="danger"
        onConfirm={async () => {
          if (deletingSkill?._id) {
            await deleteSkill(deletingSkill._id);
            setDeletingSkill(null);
          }
        }}
        onCancel={() => setDeletingSkill(null)}
      />
    </div>
  );
}

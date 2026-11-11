import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import PropTypes from 'prop-types';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Zap,
  Globe,
  Code2,
  FileText,
  Brain,
  Sparkles,
  Layers,
  Star,
  Compass,
  Database,
} from 'lucide-react';
import { useSkillStore } from '@/store/skillStore';
import { cn } from '@/lib/utils/cn';
import styles from './SlashSkillsPopover.module.scss';

export const SlashSkillsPopover = forwardRef(function SlashSkillsPopover(
  {
    open,
    onClose,
    onSelectSkill,
    searchQuery = '',
  },
  ref,
) {
  const { skills, activeSkill, fetchSkills } = useSkillStore();
  // currentView: 'root' | 'all' | 'system' | 'custom' | 'favorites'
  const [currentView, setCurrentView] = useState('root');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (open) {
      fetchSkills();
      setCurrentView('root');
      setSelectedIndex(0);
    }
  }, [open, fetchSkills]);

  // Handle click outside to close popover
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  // Clean query: strip leading slash if present
  const cleanQuery = useMemo(() => {
    if (!searchQuery) return '';
    return searchQuery.startsWith('/') ? searchQuery.slice(1).trim() : searchQuery.trim();
  }, [searchQuery]);

  // Filter skills for sub-views or live search
  const visibleSkills = useMemo(() => {
    if (cleanQuery) {
      const q = cleanQuery.toLowerCase();
      return skills.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.tools?.some((t) => t.toLowerCase().includes(q)) ||
          s.category?.toLowerCase().includes(q) ||
          (s.slug && s.slug.toLowerCase().includes(q)),
      );
    }

    if (currentView === 'system') {
      return skills.filter((s) => s.isSystem);
    }
    if (currentView === 'custom') {
      return skills.filter((s) => !s.isSystem);
    }
    if (currentView === 'favorites') {
      return skills.filter((s) => s.isFavorite);
    }
    return skills;
  }, [skills, currentView, cleanQuery]);

  const systemSkillsCount = useMemo(() => skills.filter((s) => s.isSystem).length, [skills]);
  const customSkillsCount = useMemo(() => skills.filter((s) => !s.isSystem).length, [skills]);
  const favoriteSkillsCount = useMemo(() => skills.filter((s) => s.isFavorite).length, [skills]);

  // Root categories configuration
  const rootCategories = useMemo(
    () => [
      {
        id: 'all',
        label: 'All Skills',
        icon: Compass,
        count: `${skills.length} available`,
      },
      {
        id: 'system',
        label: 'Built-in Agents',
        icon: Zap,
        count: `${systemSkillsCount} tools`,
      },
      {
        id: 'custom',
        label: 'My Custom Skills',
        icon: Code2,
        count: `${customSkillsCount} custom`,
      },
      {
        id: 'favorites',
        label: 'Favorites',
        icon: Star,
        count: `${favoriteSkillsCount} saved`,
      },
    ],
    [skills.length, systemSkillsCount, customSkillsCount, favoriteSkillsCount],
  );

  // Reset selected index when view or query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [currentView, cleanQuery]);

  // Auto-scroll highlighted row into view
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const activeEl = popoverRef.current?.querySelector('[data-highlighted="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 10);
    return () => clearTimeout(timer);
  }, [selectedIndex, currentView, cleanQuery, open]);

  const handlePickSkill = useCallback(
    (skill) => {
      onSelectSkill(skill);
      setCurrentView('root');
    },
    [onSelectSkill],
  );

  // Expose keyboard navigation handler to composer input/hero
  useImperativeHandle(
    ref,
    () => ({
      handleKeyDown: (e) => {
        if (!open) return false;

        const isSearching = Boolean(cleanQuery);
        const isRoot = currentView === 'root' && !isSearching;
        const totalItems = isRoot ? rootCategories.length : visibleSkills.length;

        if (e.key === 'ArrowDown') {
          if (totalItems > 0) {
            setSelectedIndex((prev) => (prev + 1) % totalItems);
          }
          return true;
        }

        if (e.key === 'ArrowUp') {
          if (totalItems > 0) {
            setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
          }
          return true;
        }

        if (e.key === 'ArrowRight' && isRoot) {
          const targetCategory = rootCategories[selectedIndex]?.id || 'all';
          setCurrentView(targetCategory);
          setSelectedIndex(0);
          return true;
        }

        if (e.key === 'ArrowLeft' && !isRoot && !isSearching) {
          const prevIndex = rootCategories.findIndex((c) => c.id === currentView);
          setCurrentView('root');
          setSelectedIndex(prevIndex >= 0 ? prevIndex : 0);
          return true;
        }

        if (e.key === 'Enter') {
          if (isRoot) {
            const targetCategory = rootCategories[selectedIndex]?.id || 'all';
            setCurrentView(targetCategory);
            setSelectedIndex(0);
            return true;
          }

          if (visibleSkills.length > 0 && visibleSkills[selectedIndex]) {
            handlePickSkill(visibleSkills[selectedIndex]);
            return true;
          }
          return true;
        }

        if (e.key === 'Escape') {
          onClose();
          return true;
        }

        return false;
      },
    }),
    [open, currentView, cleanQuery, visibleSkills, selectedIndex, onClose, rootCategories, handlePickSkill],
  );

  if (!open) return null;

  const renderSkillIcon = (skill) => {
    if (skill.tools?.includes('code_execution')) {
      return <Code2 size={15} className={styles.themeCode} />;
    }
    if (skill.tools?.includes('web_search') || skill.tools?.includes('fetch_url')) {
      return <Globe size={15} className={styles.themeWeb} />;
    }
    if (skill.tools?.includes('memory_search')) {
      return <Brain size={15} className={styles.themeMemory} />;
    }
    if (skill.tools?.includes('workspace_search')) {
      return <FileText size={15} className={styles.themeDoc} />;
    }
    if (skill.tools?.includes('schema_modeling') || skill.slug?.includes('database') || skill.slug?.includes('schema')) {
      return <Database size={15} className={styles.themeCode} />;
    }
    return <Zap size={15} className={styles.themeDefault} />;
  };

  const getViewTitle = () => {
    if (currentView === 'system') return 'Built-in Agents';
    if (currentView === 'custom') return 'Custom Skills';
    if (currentView === 'favorites') return 'Favorite Skills';
    return 'All Skills';
  };

  return (
    <div
      className={styles.popoverWrapper}
      ref={popoverRef}
      role="dialog"
      aria-label="Slash Skills Menu"
    >
      <div className={styles.compactCard}>
        {/* If user typed a search query after slash (e.g. /web), show live search results */}
        {cleanQuery ? (
          <div className={styles.viewContent}>
            <div className={styles.searchHeader}>
              <span className={styles.searchLabel}>Matching &quot;/{cleanQuery}&quot;</span>
              <span className={styles.matchCount}>{visibleSkills.length} found</span>
            </div>

            <div className={styles.optionsList}>
              {visibleSkills.length === 0 ? (
                <div className={styles.emptyState}>
                  <Layers size={18} className={styles.emptyIcon} />
                  <span>No skills match &quot;/{cleanQuery}&quot;</span>
                </div>
              ) : (
                visibleSkills.map((skill, idx) => {
                  const isSelected = activeSkill?._id === skill._id;
                  const isHighlighted = selectedIndex === idx;
                  return (
                    <button
                      key={skill._id || skill.title}
                      type="button"
                      className={cn(
                        styles.skillRow,
                        isSelected && styles.selectedRow,
                        isHighlighted && styles.highlightedRow,
                      )}
                      data-highlighted={isHighlighted ? 'true' : undefined}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => handlePickSkill(skill)}
                    >
                      <div className={styles.iconWrap}>{renderSkillIcon(skill)}</div>
                      <div className={styles.skillInfo}>
                        <div className={styles.titleRow}>
                          <span className={styles.skillTitle}>{skill.title}</span>
                          {skill.isSystem ? (
                            <span className={styles.systemBadge}>Built-in</span>
                          ) : (
                            <span className={styles.customBadge}>Custom</span>
                          )}
                        </div>
                        {skill.description && (
                          <span className={styles.skillDesc}>{skill.description}</span>
                        )}
                      </div>
                      {isSelected && <Check size={14} className={styles.checkIcon} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : currentView === 'root' ? (
          /* VIEW 1: ROOT VIEW (Hierarchical Categories + Arrow Key Navigation) */
          <div className={styles.viewContent}>
            {/* Top Info Box: Active skill if selected, or Slash Skills Header */}
            {activeSkill ? (
              <div className={styles.activeSkillBox}>
                <div className={styles.activeSkillInfo}>
                  <div className={styles.titleLine}>
                    <Zap size={13} className={styles.activeZapIcon} />
                    <span className={styles.activeTitle}>{activeSkill.title}</span>
                    <span className={styles.activePill}>Active</span>
                  </div>
                  <span className={styles.tagline}>
                    {activeSkill.description || 'Currently active skill for this prompt'}
                  </span>
                </div>
                <div className={styles.checkWrap}>
                  <Check size={15} className={styles.checkIcon} />
                </div>
              </div>
            ) : (
              <div className={styles.headerBox}>
                <div className={styles.headerInfo}>
                  <div className={styles.titleLine}>
                    <Sparkles size={14} className={styles.sparkleIcon} />
                    <span className={styles.headerTitle}>Slash Skills</span>
                  </div>
                  <span className={styles.tagline}>Supercharge chat with agent capabilities</span>
                </div>
              </div>
            )}

            <div className={styles.divider} />

            {/* Navigation Rows with Arrow Key Highlight and Enter Drill-Down */}
            {rootCategories.map((cat, idx) => {
              const IconComp = cat.icon;
              const isHighlighted = selectedIndex === idx;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={cn(styles.navRow, isHighlighted && styles.highlightedRow)}
                  data-highlighted={isHighlighted ? 'true' : undefined}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => {
                    setCurrentView(cat.id);
                    setSelectedIndex(0);
                  }}
                >
                  <div className={styles.navLeft}>
                    <IconComp size={15} className={styles.navIcon} />
                    <span className={styles.navLabel}>{cat.label}</span>
                  </div>
                  <div className={styles.navValueWrap}>
                    <span className={styles.navValue}>{cat.count}</span>
                    <ChevronRight size={14} className={styles.chevronIcon} />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* VIEW 2: SUB-VIEW (Category list with Back button at top) */
          <div className={styles.viewContent}>
            <div className={styles.viewHeader}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => {
                  const prevIndex = rootCategories.findIndex((c) => c.id === currentView);
                  setCurrentView('root');
                  setSelectedIndex(prevIndex >= 0 ? prevIndex : 0);
                }}
                aria-label="Back to slash menu"
              >
                <ChevronLeft size={16} />
                <span>{getViewTitle()}</span>
              </button>
            </div>

            <div className={styles.optionsList}>
              {visibleSkills.length === 0 ? (
                <div className={styles.emptyState}>
                  <Layers size={18} className={styles.emptyIcon} />
                  <span>No skills in this category</span>
                </div>
              ) : (
                visibleSkills.map((skill, idx) => {
                  const isSelected = activeSkill?._id === skill._id;
                  const isHighlighted = selectedIndex === idx;
                  return (
                    <button
                      key={skill._id || skill.title}
                      type="button"
                      className={cn(
                        styles.skillRow,
                        isSelected && styles.selectedRow,
                        isHighlighted && styles.highlightedRow,
                      )}
                      data-highlighted={isHighlighted ? 'true' : undefined}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => handlePickSkill(skill)}
                    >
                      <div className={styles.iconWrap}>{renderSkillIcon(skill)}</div>
                      <div className={styles.skillInfo}>
                        <div className={styles.titleRow}>
                          <span className={styles.skillTitle}>{skill.title}</span>
                          {skill.isSystem ? (
                            <span className={styles.systemBadge}>Built-in</span>
                          ) : (
                            <span className={styles.customBadge}>Custom</span>
                          )}
                        </div>
                        {skill.description && (
                          <span className={styles.skillDesc}>{skill.description}</span>
                        )}
                      </div>
                      {isSelected && <Check size={14} className={styles.checkIcon} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Keyboard navigation quick helper hints footer */}
        <div className={styles.keyboardHintsFooter}>
          <span className={styles.hintItem}>
            <kbd className={styles.hintKbd}>↑↓</kbd> Navigate
          </span>
          <span className={styles.hintItem}>
            <kbd className={styles.hintKbd}>↵</kbd>{' '}
            {currentView === 'root' && !cleanQuery ? 'Open' : 'Select'}
          </span>
          {currentView !== 'root' && !cleanQuery && (
            <span className={styles.hintItem}>
              <kbd className={styles.hintKbd}>←</kbd> Back
            </span>
          )}
          <span className={styles.hintItem}>
            <kbd className={styles.hintKbd}>Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
});

SlashSkillsPopover.displayName = 'SlashSkillsPopover';

SlashSkillsPopover.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelectSkill: PropTypes.func.isRequired,
  searchQuery: PropTypes.string,
};

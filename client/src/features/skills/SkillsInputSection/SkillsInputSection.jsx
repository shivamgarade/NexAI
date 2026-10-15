import { useState, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Zap,
  Globe,
  Code2,
  FileText,
  Brain,
  Sparkles,
  X,
  Layers,
  CornerDownLeft,
  Star,
} from 'lucide-react';
import { useSkillStore } from '@/store/skillStore';
import { cn } from '@/lib/utils/cn';
import styles from './SkillsInputSection.module.scss';

export function SkillsInputSection({
  isOpen,
  onClose,
  onSelectSkill,
  searchQuery = '',
}) {
  const { skills, fetchSkills } = useSkillStore();
  const [filter, setFilter] = useState('all'); // 'all' | 'system' | 'custom' | 'favorites'
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    if (isOpen) {
      fetchSkills();
    }
  }, [isOpen, fetchSkills]);

  // Clean the query: if searchQuery has leading slash, strip it
  const cleanQuery = useMemo(() => {
    if (!searchQuery) return '';
    return searchQuery.startsWith('/') ? searchQuery.slice(1).trim() : searchQuery.trim();
  }, [searchQuery]);

  const filteredSkills = useMemo(() => {
    let pool = skills;

    if (filter === 'system') {
      pool = pool.filter((s) => s.isSystem);
    } else if (filter === 'custom') {
      pool = pool.filter((s) => !s.isSystem);
    } else if (filter === 'favorites') {
      pool = pool.filter((s) => s.isFavorite);
    }

    if (cleanQuery) {
      const q = cleanQuery.toLowerCase();
      pool = pool.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.tools?.some((t) => t.toLowerCase().includes(q)) ||
          s.category?.toLowerCase().includes(q) ||
          (s.slug && s.slug.toLowerCase().includes(q)),
      );
    }

    return pool;
  }, [skills, filter, cleanQuery]);

  // Reset selected index when filter results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredSkills.length, filter, cleanQuery]);

  // Scroll active item into view when navigating via arrow keys
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex].scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  // Intercept keyboard navigation globally while the skills drawer is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % (filteredSkills.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) =>
          prev - 1 < 0 ? Math.max(0, filteredSkills.length - 1) : prev - 1,
        );
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filteredSkills.length > 0 && selectedIndex < filteredSkills.length) {
          e.preventDefault();
          e.stopPropagation();
          onSelectSkill(filteredSkills[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, filteredSkills, selectedIndex, onSelectSkill, onClose]);

  if (!isOpen) return null;

  const renderToolIcon = (tool) => {
    switch (tool) {
      case 'web_search':
        return <Globe size={11} />;
      case 'fetch_url':
        return <Globe size={11} />;
      case 'code_execution':
        return <Code2 size={11} />;
      case 'workspace_search':
        return <FileText size={11} />;
      case 'memory_search':
        return <Brain size={11} />;
      default:
        return <Sparkles size={11} />;
    }
  };

  const getSkillVisualTheme = (skill) => {
    if (skill.tools?.includes('code_execution')) {
      return {
        icon: <Code2 size={15} />,
        themeClass: styles.themeCode,
      };
    }
    if (skill.tools?.includes('web_search') || skill.tools?.includes('fetch_url')) {
      return {
        icon: <Globe size={15} />,
        themeClass: styles.themeWeb,
      };
    }
    if (skill.tools?.includes('memory_search')) {
      return {
        icon: <Brain size={15} />,
        themeClass: styles.themeMemory,
      };
    }
    if (skill.tools?.includes('workspace_search')) {
      return {
        icon: <FileText size={15} />,
        themeClass: styles.themeDoc,
      };
    }
    return {
      icon: <Zap size={15} />,
      themeClass: styles.themeDefault,
    };
  };

  const getSkillSlug = (skill) => {
    if (skill.slug) return skill.slug;
    return skill.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  };

  return (
    <div
      className={styles.integratedSection}
      role="region"
      aria-label="Integrated Skills Section"
    >
      {/* Top Header Bar */}
      <div className={styles.headerBar}>
        <div className={styles.headerLeft}>
          <div className={styles.sectionBadge}>
            <Zap size={12} className={styles.zapHeaderIcon} />
            <span>AGENT SKILLS</span>
          </div>

          {cleanQuery && (
            <div className={styles.activeQueryBadge}>
              <span className={styles.slashPrefix}>/</span>
              <span className={styles.queryText}>{cleanQuery}</span>
            </div>
          )}

          <div className={styles.tabsRow}>
            {[
              { id: 'all', label: 'All' },
              { id: 'system', label: 'Built-in' },
              { id: 'custom', label: 'Custom' },
              { id: 'favorites', label: '★ Favorites' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={cn(styles.tabBtn, filter === tab.id && styles.activeTab)}
                onClick={(e) => {
                  e.stopPropagation();
                  setFilter(tab.id);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.keyboardHints}>
            <span className={styles.hintTag}><kbd className={styles.kbd}>↑↓</kbd> navigate</span>
            <span className={styles.hintTag}><kbd className={styles.kbd}>↵</kbd> select</span>
            <span className={styles.hintTag}><kbd className={styles.kbd}>esc</kbd> close</span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            title="Close skills (Esc)"
            aria-label="Close skills section"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Skills List */}
      <div className={styles.skillsList} ref={listRef} role="listbox">
        {filteredSkills.length === 0 ? (
          <div className={styles.emptyState}>
            <Layers size={20} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No skills match &quot;/{cleanQuery}&quot;</p>
            <p className={styles.emptySubtitle}>Try browsing all skills or refine your search query</p>
          </div>
        ) : (
          filteredSkills.map((skill, index) => {
            const isSelected = index === selectedIndex;
            const visual = getSkillVisualTheme(skill);
            const slug = getSkillSlug(skill);

            return (
              <div
                key={skill._id || skill.title}
                ref={(el) => (itemRefs.current[index] = el)}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                className={cn(
                  styles.skillItem,
                  visual.themeClass,
                  isSelected && styles.skillItemSelected,
                )}
                onClick={() => onSelectSkill(skill)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className={styles.iconWrapper}>
                  {visual.icon}
                </div>

                <div className={styles.skillDetails}>
                  <div className={styles.itemTitleRow}>
                    <span className={styles.itemTitle}>{skill.title}</span>
                    <span className={styles.slugTag}>/{slug}</span>

                    {skill.isSystem ? (
                      <span className={styles.systemTag}>Built-in</span>
                    ) : (
                      <span className={styles.customTag}>Custom</span>
                    )}

                    {skill.isFavorite && (
                      <Star size={11} className={styles.favStar} fill="currentColor" />
                    )}

                    {skill.category && (
                      <span className={styles.categoryBadge}>{skill.category}</span>
                    )}
                  </div>

                  {skill.description && (
                    <p className={styles.itemDescription}>{skill.description}</p>
                  )}
                </div>

                <div className={styles.itemRightSide}>
                  {skill.tools && skill.tools.length > 0 && (
                    <div className={styles.toolsRow}>
                      {skill.tools.slice(0, 2).map((tool) => (
                        <span key={tool} className={styles.toolPill}>
                          {renderToolIcon(tool)}
                          <span>{tool.replace(/_/g, ' ')}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className={cn(styles.actionHint, isSelected && styles.actionHintVisible)}>
                    <span>Select</span>
                    <CornerDownLeft size={10} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

SkillsInputSection.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelectSkill: PropTypes.func.isRequired,
  searchQuery: PropTypes.string,
};

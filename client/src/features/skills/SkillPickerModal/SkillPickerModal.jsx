import { useState, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import {
  Search,
  Zap,
  Globe,
  Code2,
  FileText,
  Brain,
  Sparkles,
  Compass,
  Timer,
  Clock,
  ListTodo,
  Users,
  Lightbulb,
} from 'lucide-react';
import { useSkillStore } from '@/store/skillStore';
import { cn } from '@/lib/utils/cn';
import styles from './SkillPickerModal.module.scss';

export function SkillPickerModal({ open, onClose, onSelectSkill, inline = false, query = '' }) {
  const { skills, fetchSkills } = useSkillStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'system' | 'custom' | 'favorites'
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (open) {
      fetchSkills();
      setSearch(query || '');
      setActiveIndex(0);
    }
  }, [open, fetchSkills, query]);

  // Sync external typed query (e.g. user typed "/code")
  useEffect(() => {
    if (inline && query !== undefined) {
      setSearch(query);
      setActiveIndex(0);
    }
  }, [inline, query]);

  // Click-outside listener: dismiss autocomplete if user clicks anywhere else
  useEffect(() => {
    if (!open || !inline) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open, inline, onClose]);

  const filteredSkills = useMemo(() => {
    let pool = skills;

    if (!inline) {
      if (filter === 'system') {
        pool = pool.filter((s) => s.isSystem);
      } else if (filter === 'custom') {
        pool = pool.filter((s) => !s.isSystem);
      } else if (filter === 'favorites') {
        pool = pool.filter((s) => s.isFavorite);
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim().replace(/^[/@]/, '');
      if (q) {
        pool = pool.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.slug?.toLowerCase().includes(q) ||
            s.description?.toLowerCase().includes(q) ||
            s.tools?.some((t) => t.toLowerCase().includes(q)) ||
            s.category?.toLowerCase().includes(q),
        );
      }
    }

    return pool;
  }, [skills, filter, search, inline]);

  // Keyboard navigation for inline autocomplete list (Up, Down, Enter, Escape)
  useEffect(() => {
    if (!open || !inline) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (filteredSkills.length ? (prev + 1) % filteredSkills.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) =>
          filteredSkills.length ? (prev - 1 + filteredSkills.length) % filteredSkills.length : 0,
        );
      } else if (e.key === 'Enter') {
        if (filteredSkills[activeIndex]) {
          e.preventDefault();
          onSelectSkill?.(filteredSkills[activeIndex]);
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, inline, filteredSkills, activeIndex, onSelectSkill, onClose]);

  // Keep highlighted item visible when navigating with arrow keys
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.children[activeIndex];
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const getSkillIcon = (skill) => {
    const iconName = skill.icon || '';
    const slug = (skill.slug || skill.title || '').toLowerCase();
    const category = (skill.category || '').toLowerCase();

    if (slug.includes('goal') || slug.includes('target')) return <Timer size={14} />;
    if (slug.includes('schedule') || slug.includes('cron')) return <Clock size={14} />;
    if (slug.includes('browser') || slug.includes('web') || iconName === 'Globe') return <Globe size={14} />;
    if (slug.includes('plan') || iconName === 'ListTodo') return <ListTodo size={14} />;
    if (slug.includes('team') || iconName === 'Users') return <Users size={14} />;
    if (slug.includes('learn') || slug.includes('memory') || iconName === 'Lightbulb') return <Lightbulb size={14} />;
    if (iconName === 'Code2' || category === 'coding' || slug.includes('code')) return <Code2 size={14} />;
    if (iconName === 'Search' || category === 'research' || slug.includes('search')) return <Search size={14} />;
    if (iconName === 'FileText' || category === 'analysis' || slug.includes('doc')) return <FileText size={14} />;
    if (iconName === 'Brain' || slug.includes('reason')) return <Brain size={14} />;
    if (category === 'writing' || slug.includes('prompt')) return <Sparkles size={14} />;
    return <Zap size={14} />;
  };

  if (!open) return null;

  /* ---------------------------------------------------------
     INLINE MODE: Sleek vertical autocomplete matching Image 1
  --------------------------------------------------------- */
  if (inline) {
    return (
      <div ref={containerRef} className={styles.inlineContainer} role="region" aria-label="Agent Skills selector">
        <div className={styles.inlineList} ref={listRef}>
          {filteredSkills.length === 0 ? (
            <div className={styles.inlineEmpty}>No matching skills found.</div>
          ) : (
            filteredSkills.map((skill, index) => {
              const commandName = (skill.slug || skill.title || '').toLowerCase().replace(/\s+/g, '-');
              const isSelected = index === activeIndex;

              return (
                <button
                  key={skill._id || `skill-${index}`}
                  type="button"
                  className={cn(styles.inlineSkillRow, isSelected && styles.inlineSkillRowActive)}
                  onClick={() => {
                    onSelectSkill?.(skill);
                    onClose();
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  title={skill.description || skill.title}
                >
                  <span className={styles.inlineSkillIcon}>{getSkillIcon(skill)}</span>
                  <span className={styles.inlineSkillName}>{commandName}</span>
                  <span className={styles.inlineSkillDesc}>{skill.description}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------
     MODAL MODE (Standard fallback)
  --------------------------------------------------------- */
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Agent Skills Catalog"
      description="Choose a specialized agent capability to enhance this conversation"
      size="md"
    >
      <div className={styles.container}>
        <div className={styles.searchBar}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills by name, tools, or category..."
            leftIcon={<Search size={14} />}
            autoFocus
          />
        </div>

        <div className={styles.tabsRow}>
          {[
            { id: 'all', label: 'All Skills' },
            { id: 'system', label: 'Built-in' },
            { id: 'custom', label: 'My Skills' },
            { id: 'favorites', label: 'Favorites' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(styles.tabBtn, filter === tab.id && styles.activeTab)}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.skillsList}>
          {filteredSkills.length === 0 ? (
            <div className={styles.emptyState}>No skills found matching your filters.</div>
          ) : (
            filteredSkills.map((skill) => (
              <button
                key={skill._id}
                type="button"
                className={styles.skillItem}
                onClick={() => {
                  onSelectSkill?.(skill);
                  onClose();
                }}
              >
                <div className={styles.itemHeader}>
                  <div className={styles.itemTitleRow}>
                    <span className={styles.zapIcon}>{getSkillIcon(skill)}</span>
                    <span className={styles.itemTitle}>{skill.title}</span>
                  </div>
                  {skill.isSystem && <span className={styles.systemTag}>SYSTEM</span>}
                </div>

                <p className={styles.itemDesc}>{skill.description}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

SkillPickerModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelectSkill: PropTypes.func,
  inline: PropTypes.bool,
  query: PropTypes.string,
};

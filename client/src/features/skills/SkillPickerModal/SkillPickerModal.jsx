import { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Modal,
} from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import {
  Search,
  Zap,
  Globe,
  Code2,
  FileText,
  Brain,
  Star,
  Check,
  Sparkles,
} from 'lucide-react';
import { useSkillStore } from '@/store/skillStore';
import { cn } from '@/lib/utils/cn';
import styles from './SkillPickerModal.module.scss';

export function SkillPickerModal({ open, onClose, onSelectSkill }) {
  const { skills, fetchSkills } = useSkillStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'system' | 'custom' | 'favorites'

  useEffect(() => {
    if (open) {
      fetchSkills();
      setSearch('');
    }
  }, [open, fetchSkills]);

  const filteredSkills = useMemo(() => {
    let pool = skills;

    if (filter === 'system') {
      pool = pool.filter((s) => s.isSystem);
    } else if (filter === 'custom') {
      pool = pool.filter((s) => !s.isSystem);
    } else if (filter === 'favorites') {
      pool = pool.filter((s) => s.isFavorite);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      pool = pool.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.tools?.some((t) => t.toLowerCase().includes(q)) ||
          s.category?.toLowerCase().includes(q),
      );
    }

    return pool;
  }, [skills, filter, search]);

  const renderToolIcon = (tool) => {
    switch (tool) {
      case 'web_search':
        return <Search size={10} />;
      case 'fetch_url':
        return <Globe size={10} />;
      case 'code_execution':
        return <Code2 size={10} />;
      case 'workspace_search':
        return <FileText size={10} />;
      case 'memory_search':
        return <Brain size={10} />;
      default:
        return <Sparkles size={10} />;
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Select AI Skill" size="md">
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
            <div className={styles.empty}>No skills found matching your search.</div>
          ) : (
            filteredSkills.map((skill) => (
              <div
                key={skill._id}
                className={styles.skillItem}
                onClick={() => {
                  onSelectSkill?.(skill);
                  onClose();
                }}
                role="button"
                tabIndex={0}
              >
                <div className={styles.itemHeader}>
                  <div className={styles.itemTitleRow}>
                    <Zap size={14} className={styles.zapIcon} />
                    <span className={styles.itemTitle}>{skill.title}</span>
                    {skill.isSystem && <span className={styles.systemTag}>Built-in</span>}
                  </div>
                  {skill.category && <span className={styles.categoryBadge}>{skill.category}</span>}
                </div>

                {skill.description && (
                  <p className={styles.itemDescription}>{skill.description}</p>
                )}

                {Array.isArray(skill.tools) && skill.tools.length > 0 && (
                  <div className={styles.toolsRow}>
                    {skill.tools.map((tool) => (
                      <span key={tool} className={styles.toolPill}>
                        {renderToolIcon(tool)}
                        {tool.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
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
  onSelectSkill: PropTypes.func.isRequired,
};

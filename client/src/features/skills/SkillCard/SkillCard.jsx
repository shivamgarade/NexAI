import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Star,
  MoreHorizontal,
  Copy,
  Edit2,
  Trash2,
  Zap,
  Globe,
  Code2,
  FileText,
  Brain,
  Check,
  Eye,
  Search,
  PenTool,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';
import { toast } from '@/store/uiStore';
import { cn } from '@/lib/utils/cn';
import styles from './SkillCard.module.scss';

export function SkillCard({
  skill,
  onUse,
  onEdit,
  onDelete,
  onToggleFavorite,
  onViewDetails,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(skill.instructions || skill.template || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Skill instructions copied to clipboard');
    } catch {
      toast.error('Failed to copy instructions');
    }
  };

  const isSystem = Boolean(skill.isSystem);

  const menuItems = [
    {
      label: 'View details',
      icon: <Eye size={14} />,
      onClick: () => onViewDetails?.(skill),
    },
    {
      label: copied ? 'Copied!' : 'Copy instructions',
      icon: copied ? <Check size={14} /> : <Copy size={14} />,
      onClick: handleCopy,
    },
    ...(!isSystem
      ? [
          {
            label: 'Edit skill',
            icon: <Edit2 size={14} />,
            onClick: () => onEdit?.(skill),
          },
          {
            label: 'Delete skill',
            icon: <Trash2 size={14} />,
            onClick: () => onDelete?.(skill),
            destructive: true,
          },
        ]
      : []),
  ];

  const renderIcon = (iconName) => {
    switch (iconName) {
      case 'Search':
      case 'Globe':
        return <Globe size={18} />;
      case 'Code2':
        return <Code2 size={18} />;
      case 'FileText':
        return <FileText size={18} />;
      case 'PenTool':
        return <PenTool size={18} />;
      default:
        return <Zap size={18} />;
    }
  };

  return (
    <div
      className={cn(
        styles.card,
        isSystem && styles.systemCard,
        skill.isFavorite && styles.favoriteCard,
      )}
      onClick={() => onViewDetails?.(skill)}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewDetails?.(skill);
        }
      }}
    >
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.iconWrapper}>{renderIcon(skill.icon)}</div>
          <h3 className={styles.title} title={skill.title}>
            {skill.title}
          </h3>
        </div>

        <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={cn(styles.starBtn, skill.isFavorite && styles.isFavorite)}
            onClick={() => onToggleFavorite?.(skill._id)}
            title={skill.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={skill.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={15} fill={skill.isFavorite ? 'currentColor' : 'none'} />
          </button>

          <Dropdown
            trigger={
              <button
                type="button"
                className={styles.starBtn}
                aria-label="More skill actions"
              >
                <MoreHorizontal size={15} />
              </button>
            }
            items={menuItems}
            align="end"
          />
        </div>
      </div>

      <p className={styles.description}>{skill.description || 'Custom autonomous AI skill.'}</p>

      {/* Enabled Agentic Tools */}
      {Array.isArray(skill.tools) && skill.tools.length > 0 && (
        <div className={styles.toolBadges}>
          {skill.tools.map((tool) => (
            <span
              key={tool}
              className={cn(
                styles.toolBadge,
                tool === 'web_search' && styles.web,
                tool === 'fetch_url' && styles.web,
                tool === 'code_execution' && styles.code,
                tool === 'workspace_search' && styles.workspace,
                tool === 'memory_search' && styles.memory,
              )}
            >
              {tool === 'web_search' && <Search size={11} />}
              {tool === 'fetch_url' && <Globe size={11} />}
              {tool === 'code_execution' && <Code2 size={11} />}
              {tool === 'workspace_search' && <FileText size={11} />}
              {tool === 'memory_search' && <Brain size={11} />}
              {tool.replace('_', ' ')}
            </span>
          ))}
        </div>
      )}

      <div className={styles.footer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.metaTags}>
          {isSystem && <span className={styles.systemBadge}>Built-in</span>}
          {skill.category && <span className={styles.categoryTag}>{skill.category}</span>}
        </div>

        <Button
          size="xs"
          variant="secondary"
          rightIcon={<Zap size={12} />}
          onClick={() => onUse?.(skill)}
        >
          Use Skill
        </Button>
      </div>
    </div>
  );
}

SkillCard.propTypes = {
  skill: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    icon: PropTypes.string,
    instructions: PropTypes.string,
    template: PropTypes.string,
    tools: PropTypes.arrayOf(PropTypes.string),
    category: PropTypes.string,
    isSystem: PropTypes.bool,
    isFavorite: PropTypes.bool,
    variables: PropTypes.arrayOf(PropTypes.string),
    tags: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  onUse: PropTypes.func,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onToggleFavorite: PropTypes.func,
  onViewDetails: PropTypes.func,
};

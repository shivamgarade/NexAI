import { useState } from 'react';
import PropTypes from 'prop-types';
import { Star, MoreHorizontal, Copy, Edit2, Trash2, Terminal, Check, BookmarkPlus, Sparkles, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Dropdown } from '@/components/ui/Dropdown';
import { toast } from '@/store/uiStore';
import { cn } from '@/lib/utils/cn';
import styles from './PromptCard.module.scss';

export function PromptCard({
  prompt,
  onUse,
  onEdit,
  onDelete,
  onToggleFavorite,
  onClone,
  onViewDetails,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyTemplate = async (e) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(prompt.template);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Template copied to clipboard');
    } catch {
      toast.error('Failed to copy template');
    }
  };

  const isStarter = Boolean(prompt.isStarter);

  const menuItems = isStarter
    ? [
        {
          label: 'View details',
          icon: <Eye size={14} />,
          onClick: () => onViewDetails?.(prompt),
        },
        {
          label: copied ? 'Copied!' : 'Copy template',
          icon: copied ? <Check size={14} /> : <Copy size={14} />,
          onClick: handleCopyTemplate,
        },
        {
          label: 'Save copy to My Vault',
          icon: <BookmarkPlus size={14} />,
          onClick: () => onClone?.(prompt),
        },
      ]
    : [
        {
          label: 'View details',
          icon: <Eye size={14} />,
          onClick: () => onViewDetails?.(prompt),
        },
        {
          label: copied ? 'Copied!' : 'Copy template',
          icon: copied ? <Check size={14} /> : <Copy size={14} />,
          onClick: handleCopyTemplate,
        },
        {
          label: 'Edit prompt',
          icon: <Edit2 size={14} />,
          onClick: () => onEdit?.(prompt),
        },
        { divider: true },
        {
          label: 'Delete prompt',
          icon: <Trash2 size={14} />,
          danger: true,
          onClick: () => onDelete?.(prompt),
        },
      ];

  const variableCount = prompt.variables?.length || 0;

  const handleCardClick = () => {
    onViewDetails?.(prompt);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.target === e.currentTarget) {
        e.preventDefault();
        onViewDetails?.(prompt);
      }
    }
  };

  return (
    <div
      className={cn(
        styles.card,
        prompt.isFavorite && styles.favoriteCard,
        isStarter && styles.starterCard,
      )}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`View details for prompt: ${prompt.title}`}
    >
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          {isStarter ? (
            <span
              className={styles.starBtn}
              title="Curated Starter Template"
              style={{ color: 'var(--color-accent)' }}
              aria-label="Curated Starter Template"
            >
              <Sparkles size={16} />
            </span>
          ) : (
            <button
              type="button"
              className={cn(styles.starBtn, prompt.isFavorite && styles.isFavorite)}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite?.(prompt._id);
              }}
              title={prompt.isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
              aria-label={prompt.isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
            >
              <Star size={16} fill={prompt.isFavorite ? 'currentColor' : 'none'} />
            </button>
          )}
          <h3 className={styles.title} title={prompt.title}>
            {prompt.title}
          </h3>
        </div>

        <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
          <Dropdown
            trigger={
              <IconButton
                icon={<MoreHorizontal size={15} />}
                label="Prompt options"
                size="sm"
                variant="ghost"
              />
            }
            items={menuItems}
            align="right"
            portal
          />
        </div>
      </div>

      {prompt.description && <p className={styles.description}>{prompt.description}</p>}

      <div className={styles.footer}>
        <div className={styles.variableInfo}>
          {isStarter && (
            <Badge tone="accent" size="sm" style={{ marginRight: '6px' }}>
              Curated
            </Badge>
          )}
          {variableCount > 0 ? (
            <Badge tone="neutral" size="sm">
              <span className={styles.varCount}>
                {variableCount} {variableCount === 1 ? 'var' : 'vars'}
              </span>
            </Badge>
          ) : (
            <Badge tone="neutral" size="sm">
              Static
            </Badge>
          )}
        </div>

        <div className={styles.footerActions} onClick={(e) => e.stopPropagation()}>
          {isStarter && onClone && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<BookmarkPlus size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                onClone?.(prompt);
              }}
              title="Save a copy to your vault"
            >
              Save
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Terminal size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              onUse?.(prompt);
            }}
            className={styles.useButton}
          >
            Use Prompt
          </Button>
        </div>
      </div>
    </div>
  );
}

PromptCard.propTypes = {
  prompt: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    template: PropTypes.string.isRequired,
    variables: PropTypes.arrayOf(PropTypes.string),
    tags: PropTypes.arrayOf(PropTypes.string),
    category: PropTypes.string,
    isFavorite: PropTypes.bool,
    isStarter: PropTypes.bool,
  }).isRequired,
  onUse: PropTypes.func,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onToggleFavorite: PropTypes.func,
  onClone: PropTypes.func,
  onViewDetails: PropTypes.func,
};

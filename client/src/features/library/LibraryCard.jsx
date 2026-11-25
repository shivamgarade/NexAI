import PropTypes from 'prop-types';
import {
  FileText,
  Globe,
  BookOpen,
  Paperclip,
  Mic,
  Pencil,
  Trash2,
  ExternalLink,
  Eye,
  Pin,
  MessageSquare,
} from 'lucide-react';
import { formatDate } from '@/lib/utils/formatDate';
import { formatFileSize } from '@/lib/utils/formatFileSize';
import { cn } from '@/lib/utils/cn';
import styles from './LibraryCard.module.scss';

export function LibraryCard({
  item,
  onCardClick,
  onEdit,
  onDelete,
  onTagClick,
  onTogglePin,
  onSendToChat,
  activeTag,
}) {
  const isNote = item.type === 'note';
  const isLink = item.type === 'link';
  const isDoc = item.type === 'document';
  const isFile = item.type === 'file';
  const isInterview = item.type === 'interview';

  let hostname = '';
  if (isLink && item.url) {
    try {
      hostname = new URL(item.url).hostname.replace(/^www\./, '');
    } catch {
      hostname = '';
    }
  }

  const getTypeMeta = () => {
    switch (item.type) {
      case 'note':
        return { label: 'Note', icon: <FileText size={12} />, class: styles.note };
      case 'link':
        return { label: 'Link', icon: <Globe size={12} />, class: styles.link };
      case 'document':
        return { label: 'Doc', icon: <BookOpen size={12} />, class: styles.document };
      case 'file':
        return { label: 'File', icon: <Paperclip size={12} />, class: styles.file };
      case 'interview':
        return { label: 'Interview', icon: <Mic size={12} />, class: styles.interview };
      default:
        return { label: 'Note', icon: <FileText size={12} />, class: styles.note };
    }
  };

  const typeMeta = getTypeMeta();

  // Word count for notes
  const noteWordCount =
    isNote && item.content ? item.content.trim().split(/\s+/).filter(Boolean).length : 0;

  const previewExcerpt =
    item.summary ||
    (isNote && item.content ? item.content : '') ||
    (isDoc && Array.isArray(item.sections) && item.sections[0]
      ? `${item.sections[0].heading}: ${item.sections[0].body}`
      : 'Click to view full details...');

  const getScoreColorClass = (score) => {
    if (score >= 85) return styles.scoreSuccess;
    if (score >= 70) return styles.scoreAccent;
    if (score >= 50) return styles.scoreWarning;
    return styles.scoreDanger;
  };

  const handleCardClick = () => {
    onCardClick?.(item);
  };

  const handleTagClick = (e, tag) => {
    e.stopPropagation();
    onTagClick?.(tag);
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    onEdit?.(item);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    onDelete?.(item);
  };

  const handlePinClick = (e) => {
    e.stopPropagation();
    onTogglePin?.(item);
  };

  const handleSendToChatClick = (e) => {
    e.stopPropagation();
    onSendToChat?.(item);
  };

  const handleExternalLink = (e) => {
    e.stopPropagation();
  };

  return (
    <div
      className={cn(styles.cardWrapper, item.pinned && styles.isPinned)}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      aria-label={`View details for ${item.title}`}
    >
      {/* Minimal Top Bar with inline metadata & hover ghost actions */}
      <div className={styles.topBar}>
        <div className={styles.metaLeft}>
          {item.pinned && (
            <span className={styles.pinnedBadge} title="Pinned item">
              <Pin size={10} className={styles.pinnedIconFill} />
              <span>Pinned</span>
            </span>
          )}
          <span className={cn(styles.typePill, typeMeta.class)}>
            {typeMeta.icon}
            <span>{typeMeta.label}</span>
          </span>
          <span className={styles.dotSeparator}>•</span>
          <span className={styles.dateText}>{formatDate(item.createdAt)}</span>
          {isNote && noteWordCount > 0 && (
            <>
              <span className={styles.dotSeparator}>•</span>
              <span className={styles.auxMeta}>{noteWordCount} words</span>
            </>
          )}
          {isDoc && (
            <>
              {item.category && (
                <>
                  <span className={styles.dotSeparator}>•</span>
                  <span className={styles.auxMeta}>{item.category}</span>
                </>
              )}
              {Array.isArray(item.sections) && (
                <>
                  <span className={styles.dotSeparator}>•</span>
                  <span className={styles.auxMeta}>
                    {item.sections.length} {item.sections.length === 1 ? 'sec' : 'secs'}
                  </span>
                </>
              )}
            </>
          )}
          {isLink && hostname && (
            <>
              <span className={styles.dotSeparator}>•</span>
              <span className={styles.auxMeta}>{hostname}</span>
            </>
          )}
          {isFile && item.fileName && (
            <>
              <span className={styles.dotSeparator}>•</span>
              <span className={styles.auxMeta}>
                {item.size > 0 ? formatFileSize(item.size) : 'File'}
              </span>
            </>
          )}
          {isInterview && item.scorecard?.overallScore !== undefined && (
            <>
              <span className={styles.dotSeparator}>•</span>
              <span
                className={cn(
                  styles.scoreMeta,
                  getScoreColorClass(item.scorecard.overallScore),
                )}
              >
                Score: {item.scorecard.overallScore}/100
              </span>
            </>
          )}
        </div>

        {/* Hover / Quick Ghost Action Bar */}
        <div className={styles.hoverActions}>
          <button
            type="button"
            className={cn(styles.actionIconBtn, item.pinned && styles.pinnedActive)}
            onClick={handlePinClick}
            title={item.pinned ? 'Unpin item' : 'Pin to top'}
            aria-label={item.pinned ? 'Unpin item' : 'Pin to top'}
          >
            <Pin size={13} className={item.pinned ? styles.pinnedIconFill : undefined} />
          </button>

          <button
            type="button"
            className={styles.actionIconBtn}
            onClick={handleSendToChatClick}
            title="Use in AI Chat"
            aria-label="Use in AI Chat"
          >
            <MessageSquare size={13} />
          </button>

          <button
            type="button"
            className={styles.actionIconBtn}
            onClick={handleCardClick}
            title="Open Details"
            aria-label="Open details"
          >
            <Eye size={13} />
          </button>

          {isLink && item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.actionIconBtn}
              onClick={handleExternalLink}
              title="Open external link"
              aria-label="Open external link"
            >
              <ExternalLink size={13} />
            </a>
          )}

          <button
            type="button"
            className={styles.actionIconBtn}
            onClick={handleEditClick}
            title="Edit item"
            aria-label="Edit item"
          >
            <Pencil size={13} />
          </button>

          <button
            type="button"
            className={cn(styles.actionIconBtn, styles.danger)}
            onClick={handleDeleteClick}
            title="Delete item"
            aria-label="Delete item"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* If file item has an image, render preview thumbnail */}
      {isFile && (item.url || item.fileData) && (item.mimeType?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(item.fileName || item.url || '')) && (
        <div className={styles.imageCardPreview}>
          <img src={item.url || item.fileData} alt={item.title} loading="lazy" />
        </div>
      )}

      {/* Main Content Area */}
      <h3 className={styles.title} title={item.title}>
        {item.title}
      </h3>

      <p className={styles.previewText}>{previewExcerpt}</p>

      {/* Minimalist Tags List (no divider line or heavy borders) */}
      {Array.isArray(item.tags) && item.tags.length > 0 && (
        <div className={styles.bottomBar}>
          <div className={styles.tagsList}>
            {item.tags.slice(0, 3).map((tag) => (
              <button
                key={tag}
                type="button"
                className={cn(styles.tagChip, activeTag === tag && styles.activeTag)}
                onClick={(e) => handleTagClick(e, tag)}
                title={`Filter by #${tag}`}
              >
                #{tag}
              </button>
            ))}
            {item.tags.length > 3 && (
              <span className={styles.tagOverflowCount}>
                +{item.tags.length - 3}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

LibraryCard.propTypes = {
  item: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    summary: PropTypes.string,
    content: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.string),
    url: PropTypes.string,
    category: PropTypes.string,
    sections: PropTypes.array,
    fileName: PropTypes.string,
    fileData: PropTypes.string,
    size: PropTypes.number,
    scorecard: PropTypes.object,
    createdAt: PropTypes.string,
    pinned: PropTypes.bool,
  }).isRequired,
  onCardClick: PropTypes.func,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onTagClick: PropTypes.func,
  onTogglePin: PropTypes.func,
  onSendToChat: PropTypes.func,
  activeTag: PropTypes.string,
};

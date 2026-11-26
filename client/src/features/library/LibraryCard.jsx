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
  MoreVertical,
} from 'lucide-react';
import { Dropdown } from '@/components/ui/Dropdown';
import { formatDate } from '@/lib/utils/formatDate';
import { cn } from '@/lib/utils/cn';
import styles from './LibraryCard.module.scss';

export function LibraryCard({
  item,
  onCardClick,
  onEdit,
  onDelete,
  onTogglePin,
  onSendToChat,
}) {
  const isNote = item.type === 'note';
  const isLink = item.type === 'link';
  const isDoc = item.type === 'document';
  const isFile = item.type === 'file';
  const isInterview = item.type === 'interview';

  const isImage =
    isFile &&
    (item.url || item.fileData) &&
    (item.mimeType?.startsWith('image/') ||
      /\.(png|jpe?g|webp|gif|svg)$/i.test(item.fileName || item.url || ''));

  const getTypeMeta = () => {
    switch (item.type) {
      case 'note':
        return { label: 'Note', icon: <FileText size={13} />, class: styles.note };
      case 'link':
        return { label: 'Link', icon: <Globe size={13} />, class: styles.link };
      case 'document':
        return { label: 'Document', icon: <BookOpen size={13} />, class: styles.document };
      case 'file':
        return { label: 'File', icon: <Paperclip size={13} />, class: styles.file };
      case 'interview':
        return { label: 'Interview', icon: <Mic size={13} />, class: styles.interview };
      default:
        return { label: 'Note', icon: <FileText size={13} />, class: styles.note };
    }
  };

  const typeMeta = getTypeMeta();

  const previewExcerpt =
    item.summary ||
    (isNote && item.content ? item.content : '') ||
    (isDoc && Array.isArray(item.sections) && item.sections[0]
      ? `${item.sections[0].heading}: ${item.sections[0].body}`
      : 'Click to view details...');

  const menuItems = [
    {
      label: item.pinned ? 'Unpin item' : 'Pin to top',
      icon: <Pin size={13} className={item.pinned ? styles.pinnedIconFill : undefined} />,
      onClick: (e) => {
        e?.stopPropagation?.();
        onTogglePin?.(item);
      },
    },
    {
      label: 'Use in AI Chat',
      icon: <MessageSquare size={13} />,
      onClick: (e) => {
        e?.stopPropagation?.();
        onSendToChat?.(item);
      },
    },
    {
      label: 'Open Details',
      icon: <Eye size={13} />,
      onClick: (e) => {
        e?.stopPropagation?.();
        onCardClick?.(item);
      },
    },
    ...(isLink && item.url
      ? [
          {
            label: 'Open URL',
            icon: <ExternalLink size={13} />,
            onClick: (e) => {
              e?.stopPropagation?.();
              window.open(item.url, '_blank', 'noopener,noreferrer');
            },
          },
        ]
      : []),
    {
      label: 'Edit',
      icon: <Pencil size={13} />,
      onClick: (e) => {
        e?.stopPropagation?.();
        onEdit?.(item);
      },
    },
    {
      label: 'Delete',
      icon: <Trash2 size={13} />,
      destructive: true,
      onClick: (e) => {
        e?.stopPropagation?.();
        onDelete?.(item);
      },
    },
  ];

  const handleCardClick = () => {
    onCardClick?.(item);
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
      {/* Sleek Minimalist Top Header: Type Icon & Date on Left, Pin & 3-Dot on Right */}
      <div className={styles.topBar}>
        <div className={styles.metaLeft}>
          <span className={cn(styles.typeBadge, typeMeta.class)} title={typeMeta.label}>
            {typeMeta.icon}
          </span>
          <span className={styles.dateText}>{formatDate(item.createdAt)}</span>
        </div>

        <div className={styles.metaRight} onClick={(e) => e.stopPropagation()}>
          {item.pinned && (
            <span className={styles.pinIndicator} title="Pinned item">
              <Pin size={11} className={styles.pinnedIconFill} />
            </span>
          )}
          <Dropdown
            portal
            align="right"
            trigger={
              <button
                type="button"
                className={styles.moreBtn}
                aria-label="Item actions"
                title="More options"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical size={14} />
              </button>
            }
            items={menuItems}
          />
        </div>
      </div>

      {/* Main Body */}
      {isImage ? (
        <div className={styles.imageBody}>
          <div className={styles.imageCardPreview}>
            <img src={item.url || item.fileData} alt={item.title} loading="lazy" />
          </div>
          <h3 className={styles.title} title={item.title}>
            {item.title}
          </h3>
        </div>
      ) : (
        <div className={styles.textBody}>
          <h3 className={styles.title} title={item.title}>
            {item.title}
          </h3>
          <p className={styles.previewText}>{previewExcerpt}</p>
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
  onTogglePin: PropTypes.func,
  onSendToChat: PropTypes.func,
};

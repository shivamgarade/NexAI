import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Bookmark,
  FileText,
  BookOpen,
  Paperclip,
  Upload,
  Search,
  Globe,
  Mic,
  Video,
  Volume2,
  FileCode,
  FileImage,
  FileSpreadsheet,
  Archive,
  PackageOpen,
  X,
  Plus,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { libraryApi } from '@/lib/api/library.api';
import { cn } from '@/lib/utils/cn';
import styles from './AttachContextPopover.module.scss';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CODE_EXTS = /\.(js|ts|jsx|tsx|py|java|go|rb|php|c|cpp|cs|swift|kt|rs|sh|json|yaml|yml|toml|sql|html|css|scss|less|xml|md)$/i;
const SPREADSHEET_EXTS = /\.(xls|xlsx|csv|ods)$/i;
const ARCHIVE_EXTS = /\.(zip|tar|gz|rar|7z)$/i;

function getFileTypeMeta(item) {
  const mime = item.mimeType || '';
  const name = item.fileName || item.title || '';

  if (item.type === 'note') {
    return { icon: <FileText size={15} />, label: 'Note', colorKey: 'note' };
  }
  if (item.type === 'link') {
    return { icon: <Globe size={15} />, label: 'Link', colorKey: 'link' };
  }
  if (item.type === 'document') {
    return { icon: <BookOpen size={15} />, label: 'Doc', colorKey: 'document' };
  }
  if (item.type === 'interview') {
    return { icon: <Mic size={15} />, label: 'Interview', colorKey: 'interview' };
  }

  if (mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
    return { icon: <FileText size={15} />, label: 'PDF', colorKey: 'pdf' };
  }
  if (mime.startsWith('image/')) {
    return { icon: <FileImage size={15} />, label: 'Image', colorKey: 'image' };
  }
  if (mime.startsWith('video/')) {
    return { icon: <Video size={15} />, label: 'Video', colorKey: 'video' };
  }
  if (mime.startsWith('audio/')) {
    return { icon: <Volume2 size={15} />, label: 'Audio', colorKey: 'audio' };
  }
  if (CODE_EXTS.test(name)) {
    return { icon: <FileCode size={15} />, label: 'Code', colorKey: 'code' };
  }
  if (SPREADSHEET_EXTS.test(name)) {
    return { icon: <FileSpreadsheet size={15} />, label: 'Sheet', colorKey: 'sheet' };
  }
  if (ARCHIVE_EXTS.test(name)) {
    return { icon: <Archive size={15} />, label: 'Archive', colorKey: 'archive' };
  }

  return { icon: <Paperclip size={15} />, label: 'File', colorKey: 'file' };
}

function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function SkeletonRow() {
  return (
    <div className={styles.skeletonRow}>
      <div className={cn(styles.skeletonBox, styles.skeletonIcon)} />
      <div className={styles.skeletonLines}>
        <div className={cn(styles.skeletonBox, styles.skeletonTitle)} />
        <div className={cn(styles.skeletonBox, styles.skeletonSub)} />
      </div>
      <div className={cn(styles.skeletonBox, styles.skeletonBtn)} />
    </div>
  );
}

function ItemIcon({ item, meta }) {
  const isImage =
    item.type === 'file' &&
    (item.mimeType?.startsWith('image/') || item.fileData?.startsWith('data:image'));

  if (isImage && item.fileData) {
    return (
      <div className={cn(styles.itemIcon, styles[`icon_${meta.colorKey}`], styles.iconThumb)}>
        <img src={item.fileData} alt={item.title} className={styles.thumbImg} />
      </div>
    );
  }

  return (
    <div className={cn(styles.itemIcon, styles[`icon_${meta.colorKey}`])}>
      {meta.icon}
    </div>
  );
}

ItemIcon.propTypes = {
  item: PropTypes.object.isRequired,
  meta: PropTypes.object.isRequired,
};

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'documents', label: 'Docs' },
  { key: 'files', label: 'Files' },
  { key: 'notes', label: 'Notes' },
];

export function AttachContextPopover({ open, onClose, anchorRef, onSelect, onUploadLocal }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [tabFilter, setTabFilter] = useState('all');
  const popoverRef = useRef(null);

  // Close when clicking outside or pressing Escape (matching ModelSelectorPopover)
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        (!anchorRef?.current || !anchorRef.current.contains(e.target))
      ) {
        onClose?.();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, anchorRef]);

  // Fetch library items on open
  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    setIsLoading(true);

    libraryApi
      .getItems({ limit: 50 })
      .then((res) => {
        if (isMounted) {
          setItems(res.data || []);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open]);

  if (!open) return null;

  const filteredItems = items.filter((item) => {
    if (tabFilter === 'documents' && item.type !== 'document') return false;
    if (tabFilter === 'files' && item.type !== 'file') return false;
    if (tabFilter === 'notes' && !['note', 'link'].includes(item.type)) return false;
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return (
      item.title?.toLowerCase().includes(query) ||
      item.summary?.toLowerCase().includes(query) ||
      item.tags?.some((t) => t.toLowerCase().includes(query))
    );
  });

  const getItemContent = (item) => {
    if (item.content) return item.content;
    if (item.sections?.length > 0) {
      return item.sections.map((s) => `${s.heading}:\n${s.body}`).join('\n\n');
    }
    return item.summary || '';
  };

  const handleSelectItem = (item) => {
    onSelect({
      id: item._id,
      name: item.title,
      type:
        item.type === 'file' && item.mimeType?.startsWith('image/')
          ? 'image'
          : item.type === 'file' &&
              (item.mimeType === 'application/pdf' ||
                item.fileName?.toLowerCase().endsWith('.pdf'))
            ? 'pdf'
            : item.type,
      category: item.category,
      mimeType: item.mimeType,
      data: item.fileData,
      size: item.size,
      content: getItemContent(item),
    });
    onClose();
  };

  return (
    <div
      className={styles.popoverWrapper}
      ref={popoverRef}
      role="dialog"
      aria-label="Attach Context from Library"
    >
      <div className={styles.popoverCard}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.title}>
            <Bookmark size={14} className={styles.titleIcon} />
            <span>Attach Context</span>
          </div>
          <button
            type="button"
            className={styles.uploadDeviceBtn}
            onClick={() => {
              onClose();
              onUploadLocal?.();
            }}
            title="Upload new file from device"
          >
            <Upload size={12} />
            <span>Upload File</span>
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Search Bar */}
          <div className={styles.searchBarWrapper}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search library..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
              autoFocus
            />
            {search && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Tab Filters */}
          <div className={styles.tabFilters}>
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={cn(styles.tabChip, tabFilter === key && styles.activeTab)}
                onClick={() => setTabFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Items List */}
          <div className={styles.itemsList}>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
            ) : filteredItems.length === 0 ? (
              <div className={styles.emptyState}>
                <PackageOpen size={26} className={styles.emptyIcon} />
                <p className={styles.emptyTitle}>
                  {search ? 'No results found' : 'No items yet'}
                </p>
                <p className={styles.emptyHint}>
                  {search
                    ? `Nothing matched "${search}".`
                    : 'Upload a file or add notes in your Library.'}
                </p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const meta = getFileTypeMeta(item);
                const hostname = item.type === 'link' && item.url ? getHostname(item.url) : null;
                const sizeLabel = item.size ? formatBytes(item.size) : null;
                const hasCustomCategory =
                  item.category &&
                  !['other', 'general', 'default'].includes(item.category.toLowerCase());

                return (
                  <div
                    key={item._id}
                    className={styles.itemRow}
                    onClick={() => handleSelectItem(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleSelectItem(item);
                    }}
                    aria-label={`Attach ${item.title}`}
                  >
                    <ItemIcon item={item} meta={meta} />

                    <div className={styles.itemMeta}>
                      <div className={styles.itemTitleRow}>
                        <span className={styles.itemTitle}>{item.title}</span>
                        {hasCustomCategory && (
                          <Badge variant="accent" size="sm">
                            {item.category}
                          </Badge>
                        )}
                      </div>

                      <div className={styles.itemSubRow}>
                        <span className={cn(styles.typePill, styles[`pill_${meta.colorKey}`])}>
                          {meta.label}
                        </span>
                        {sizeLabel && <span className={styles.subHint}>· {sizeLabel}</span>}
                        {hostname && <span className={styles.subHint}>· {hostname}</span>}
                        {item.summary && !hostname && !sizeLabel && (
                          <span className={styles.itemSummary}>· {item.summary}</span>
                        )}
                      </div>
                    </div>

                    <div className={styles.attachAction}>
                      <Plus size={12} />
                      <span>Attach</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

AttachContextPopover.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  anchorRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  onSelect: PropTypes.func.isRequired,
  onUploadLocal: PropTypes.func,
};

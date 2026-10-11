import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Upload,
  Bookmark,
  ChevronRight,
  ChevronLeft,
  Search,
  X,
  FileText,
  FileImage,
  BookOpen,
  Mic,
  Video,
  Volume2,
  FileCode,
  FileSpreadsheet,
  Paperclip,
} from 'lucide-react';
import { libraryApi } from '@/lib/api/library.api';
import { cn } from '@/lib/utils/cn';
import styles from './AttachContextPopover.module.scss';

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CODE_EXTS = /\.(js|ts|jsx|tsx|py|java|go|rb|php|c|cpp|cs|swift|kt|rs|sh|json|yaml|yml|toml|sql|html|css|scss|less|xml|md)$/i;

function getFileTypeMeta(item) {
  const mime = item.mimeType || '';
  const name = item.fileName || item.title || '';

  if (item.type === 'note') {
    return { icon: <FileText size={14} />, label: 'Note', colorKey: 'note' };
  }
  if (item.type === 'document') {
    return { icon: <BookOpen size={14} />, label: 'Doc', colorKey: 'document' };
  }
  if (item.type === 'interview') {
    return { icon: <Mic size={14} />, label: 'Interview', colorKey: 'interview' };
  }

  if (mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
    return { icon: <FileText size={14} />, label: 'PDF', colorKey: 'pdf' };
  }
  if (mime.startsWith('image/')) {
    return { icon: <FileImage size={14} />, label: 'Image', colorKey: 'image' };
  }
  if (mime.startsWith('video/')) {
    return { icon: <Video size={14} />, label: 'Video', colorKey: 'video' };
  }
  if (mime.startsWith('audio/')) {
    return { icon: <Volume2 size={14} />, label: 'Audio', colorKey: 'audio' };
  }
  if (CODE_EXTS.test(name)) {
    return { icon: <FileCode size={14} />, label: 'Code', colorKey: 'code' };
  }
  if (/\.(xls|xlsx|csv)$/i.test(name)) {
    return { icon: <FileSpreadsheet size={14} />, label: 'Sheet', colorKey: 'sheet' };
  }

  return { icon: <Paperclip size={14} />, label: 'File', colorKey: 'file' };
}

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'documents', label: 'Docs' },
  { key: 'files', label: 'Files' },
  { key: 'notes', label: 'Notes' },
];

export function AttachContextPopover({ open, onClose, anchorRef, onSelect, onUploadLocal }) {
  // Views: 'root' | 'library'
  const [currentView, setCurrentView] = useState('root');
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [tabFilter, setTabFilter] = useState('all');
  const popoverRef = useRef(null);

  // Reset to root view whenever closed
  useEffect(() => {
    if (!open) {
      setCurrentView('root');
      setSearch('');
      setTabFilter('all');
      return;
    }

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

  // Load library items on mount / open
  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    setIsLoading(true);

    libraryApi
      .getItems({ limit: 40 })
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
      item.summary?.toLowerCase().includes(query)
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
      aria-label="Attach Context Menu"
    >
      <div className={styles.compactCard}>
        {/* VIEW 1: ROOT COMPACT VIEW */}
        {currentView === 'root' && (
          <div className={styles.viewContent}>
            {/* Direct Upload Action Card */}
            <button
              type="button"
              className={styles.uploadBox}
              onClick={() => {
                onClose();
                onUploadLocal?.();
              }}
            >
              <div className={styles.uploadIconWrap}>
                <Upload size={15} />
              </div>
              <div className={styles.uploadInfo}>
                <span className={styles.uploadTitle}>Upload from Device</span>
                <span className={styles.uploadSubtitle}>PDF, Images, Docs, Code</span>
              </div>
            </button>

            <div className={styles.divider} />

            {/* Sub-view Navigation Trigger: Library */}
            <button
              type="button"
              className={styles.navRow}
              onClick={() => setCurrentView('library')}
            >
              <div className={styles.navRowLeft}>
                <Bookmark size={15} className={styles.navIcon} />
                <span className={styles.navLabel}>Choose from Library</span>
              </div>
              <div className={styles.navValueWrap}>
                {items.length > 0 && (
                  <span className={styles.navValue}>{items.length}</span>
                )}
                <ChevronRight size={14} className={styles.chevronIcon} />
              </div>
            </button>
          </div>
        )}

        {/* VIEW 2: LIBRARY SUB-VIEW */}
        {currentView === 'library' && (
          <div className={styles.viewContent}>
            <div className={styles.viewHeader}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => setCurrentView('root')}
                aria-label="Back to main attachment menu"
              >
                <ChevronLeft size={16} />
                <span>Library</span>
              </button>
              <button
                type="button"
                className={styles.quickUploadLink}
                onClick={() => {
                  onClose();
                  onUploadLocal?.();
                }}
              >
                Upload file
              </button>
            </div>

            {/* Compact Search Bar */}
            <div className={styles.searchBarWrapper}>
              <Search size={13} className={styles.searchIcon} />
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
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Quick Tabs */}
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

            {/* Scrollable Items List */}
            <div className={styles.scrollableList}>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={styles.skeletonRow}>
                    <div className={cn(styles.skeletonBox, styles.skeletonIcon)} />
                    <div className={styles.skeletonLines}>
                      <div className={cn(styles.skeletonBox, styles.skeletonTitle)} />
                      <div className={cn(styles.skeletonBox, styles.skeletonSub)} />
                    </div>
                  </div>
                ))
              ) : filteredItems.length === 0 ? (
                <div className={styles.emptyState}>
                  <span>{search ? 'No matches found' : 'No items yet'}</span>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const meta = getFileTypeMeta(item);
                  const isImageThumb =
                    item.type === 'file' &&
                    item.fileData &&
                    (item.mimeType?.startsWith('image/') ||
                      item.fileData?.startsWith('data:image'));
                  const sizeStr = item.size ? formatBytes(item.size) : null;

                  return (
                    <button
                      key={item._id}
                      type="button"
                      className={styles.optionRow}
                      onClick={() => handleSelectItem(item)}
                    >
                      <div
                        className={cn(
                          styles.itemIcon,
                          styles[`icon_${meta.colorKey}`],
                          isImageThumb && styles.iconThumb
                        )}
                      >
                        {isImageThumb ? (
                          <img
                            src={item.fileData}
                            alt={item.title}
                            className={styles.thumbImg}
                          />
                        ) : (
                          meta.icon
                        )}
                      </div>

                      <div className={styles.itemMeta}>
                        <span className={styles.itemTitle}>{item.title}</span>
                        <div className={styles.itemSub}>
                          <span>{meta.label}</span>
                          {sizeStr && <span>· {sizeStr}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
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

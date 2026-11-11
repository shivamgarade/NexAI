import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  X,
  Image as ImageIcon,
  Volume2,
  Video,
  FileText,
  Bookmark,
  FileCode,
} from 'lucide-react';
import { AttachmentLightbox } from '../AttachmentLightbox';
import { cn } from '@/lib/utils/cn';
import styles from './AttachedContextPreview.module.scss';

export function AttachedContextPreview({ contexts, context, onRemove, className }) {
  const [activePreviewItem, setActivePreviewItem] = useState(null);

  // Normalize to an array of items
  const items = Array.isArray(contexts)
    ? contexts
    : context
      ? [context]
      : [];

  if (items.length === 0) return null;

  return (
    <>
      <div
        className={cn(styles.previewContainer, className)}
        role="region"
        aria-label="Attached context preview"
      >
        {items.map((item, index) => {
          if (!item) return null;
          const isImage = item.type === 'image' || item.mimeType?.startsWith('image/');
          const isAudio = item.type === 'audio' || item.mimeType?.startsWith('audio/');
          const isVideo = item.type === 'video' || item.mimeType?.startsWith('video/');
          const isPdf =
            item.type === 'pdf' ||
            item.mimeType === 'application/pdf' ||
            item.name?.toLowerCase().endsWith('.pdf');
          const isLibraryItem = Boolean(
            item.category ||
            item.id ||
            item.type === 'document' ||
            item.type === 'note'
          );

          return (
            <div key={`preview-att-${index}-${item.name || 'file'}`} className={styles.itemWrapper}>
              {/* 1. Standalone Image Thumbnail (Clickable to open pop-up preview) */}
              {isImage ? (
                <div
                  className={styles.standaloneImageCard}
                  onClick={() => setActivePreviewItem(item)}
                  title="Click to preview image"
                >
                  {item.data ? (
                    <img
                      src={item.data}
                      alt={item.name || 'Attached image'}
                      className={styles.standaloneThumbnail}
                    />
                  ) : (
                    <div className={styles.fallbackThumbnail}>
                      <ImageIcon size={20} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove?.(index);
                    }}
                    className={styles.imageCancelBtn}
                    aria-label="Remove attached image"
                    title="Remove image"
                  >
                    <X size={11} />
                  </button>
                </div>
              ) : (
                /* 2. Compact Single-Line Chip for Non-Image Attachments */
                <div
                  className={styles.compactChip}
                  onClick={() => {
                    if (isPdf || item.data || item.content) {
                      setActivePreviewItem(item);
                    }
                  }}
                  title={isPdf ? 'Click to preview document' : item.name}
                >
                  <span className={styles.chipIcon}>
                    {isPdf ? (
                      <FileText size={13} />
                    ) : isAudio ? (
                      <Volume2 size={13} />
                    ) : isVideo ? (
                      <Video size={13} />
                    ) : isLibraryItem ? (
                      <Bookmark size={13} />
                    ) : item.name?.match(/\.(js|ts|jsx|tsx|py|json|html|css|sql|sh)$/i) ? (
                      <FileCode size={13} />
                    ) : (
                      <FileText size={13} />
                    )}
                  </span>
                  <span className={styles.chipTitle}>
                    {item.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove?.(index);
                    }}
                    className={styles.chipRemoveBtn}
                    aria-label="Remove attached item"
                    title="Remove attachment"
                  >
                    <X size={11} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Lightbox Preview without clunky modal shell */}
      <AttachmentLightbox
        open={Boolean(activePreviewItem)}
        item={activePreviewItem}
        onClose={() => setActivePreviewItem(null)}
      />
    </>
  );
}

AttachedContextPreview.propTypes = {
  contexts: PropTypes.array,
  context: PropTypes.object,
  onRemove: PropTypes.func,
  className: PropTypes.string,
};

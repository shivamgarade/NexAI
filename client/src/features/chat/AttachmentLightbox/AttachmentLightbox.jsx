import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { X, Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import styles from './AttachmentLightbox.module.scss';

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentLightbox({ item, open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || !item) return null;

  const srcUrl = item.src || item.data || (item.fileData ? item.fileData : '');
  const fileName = item.name || item.title || item.fileName || 'Attachment';
  const isImage =
    item.type === 'image' ||
    item.mimeType?.startsWith('image/') ||
    fileName.match(/\.(jpe?g|png|gif|webp|svg|bmp)$/i);
  const isPdf =
    item.type === 'pdf' ||
    item.mimeType === 'application/pdf' ||
    fileName.toLowerCase().endsWith('.pdf');

  const handleDownload = (e) => {
    e.stopPropagation();
    if (!srcUrl) return;
    const a = document.createElement('a');
    a.href = srcUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${fileName}`}
    >
      <div className={styles.mediaContainer} onClick={(e) => e.stopPropagation()}>
        {/* Top-left: Filename & size pill with dark overlay backing */}
        <div className={styles.metaOverlay}>
          <span className={styles.metaName} title={fileName}>
            {fileName}
          </span>
          {item.size ? <span className={styles.metaSize}>{formatBytes(item.size)}</span> : null}
        </div>

        {/* Top-right: Floating action buttons with dark overlay backing */}
        <div className={styles.actionsOverlay}>
          {srcUrl && (
            <button
              type="button"
              className={styles.overlayBtn}
              onClick={handleDownload}
              title="Download file"
              aria-label="Download file"
            >
              <Download size={15} />
            </button>
          )}
          <button
            type="button"
            className={cn(styles.overlayBtn, styles.closeBtn)}
            onClick={onClose}
            title="Close preview (Esc)"
            aria-label="Close preview"
          >
            <X size={16} />
          </button>
        </div>

        {/* Media content */}
        {isImage && srcUrl ? (
          <img src={srcUrl} alt={fileName} className={styles.previewImage} />
        ) : isPdf && srcUrl ? (
          <iframe
            src={srcUrl}
            title={fileName}
            className={styles.pdfIframe}
          />
        ) : (
          <div className={styles.fallbackDoc}>
            <FileText size={48} className={styles.fallbackIcon} />
            <span className={styles.fallbackName}>{fileName}</span>
            {item.content && (
              <pre className={styles.fallbackContent}>{item.content.slice(0, 3000)}</pre>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

AttachmentLightbox.propTypes = {
  item: PropTypes.object,
  open: PropTypes.bool,
  onClose: PropTypes.func,
};

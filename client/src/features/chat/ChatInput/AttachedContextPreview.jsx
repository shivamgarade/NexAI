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
import { cn } from '@/lib/utils/cn';
import styles from './AttachedContextPreview.module.scss';

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachedContextPreview({ context, onRemove, className }) {
  if (!context) return null;

  const isImage = context.type === 'image' || context.mimeType?.startsWith('image/');
  const isAudio = context.type === 'audio' || context.mimeType?.startsWith('audio/');
  const isVideo = context.type === 'video' || context.mimeType?.startsWith('video/');
  const isPdf =
    context.type === 'pdf' ||
    context.mimeType === 'application/pdf' ||
    context.name?.toLowerCase().endsWith('.pdf');
  const isLibraryItem = Boolean(context.category || context.id || context.type === 'document' || context.type === 'note');

  // Preview snippet for text/library content
  const previewSnippet = context.content
    ? context.content.replace(/\s+/g, ' ').trim().slice(0, 85)
    : null;

  return (
    <div className={cn(styles.previewContainer, className)} role="region" aria-label="Attached context preview">
      {/* 1. Image Preview with real thumbnail */}
      {isImage && (
        <div className={cn(styles.previewCard, styles.imageCard)}>
          {context.data ? (
            <div className={styles.imageThumbnailWrapper}>
              <img src={context.data} alt={context.name} className={styles.imageThumbnail} />
            </div>
          ) : (
            <div className={styles.iconWrapper}>
              <ImageIcon size={18} />
            </div>
          )}
          <div className={styles.cardDetails}>
            <div className={styles.topInfo}>
              <span className={styles.badgeLabel}>Image</span>
              {context.size ? <span className={styles.sizeLabel}>{formatBytes(context.size)}</span> : null}
            </div>
            <span className={styles.fileName} title={context.name}>
              {context.name}
            </span>
            {context.isUploading && (
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${context.progress || 60}%` }} />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            className={styles.removeBtn}
            aria-label="Remove attached image"
            title="Remove attachment"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. Audio Preview */}
      {isAudio && (
        <div className={cn(styles.previewCard, styles.audioCard)}>
          <div className={styles.audioIconWrapper}>
            <Volume2 size={18} className={styles.audioIcon} />
            <div className={styles.waveBar} />
            <div className={styles.waveBar} />
            <div className={styles.waveBar} />
          </div>
          <div className={styles.cardDetails}>
            <div className={styles.topInfo}>
              <span className={cn(styles.badgeLabel, styles.audioBadge)}>Audio</span>
              {context.size ? <span className={styles.sizeLabel}>{formatBytes(context.size)}</span> : null}
            </div>
            <span className={styles.fileName} title={context.name}>
              {context.name}
            </span>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className={styles.removeBtn}
            aria-label="Remove attached audio"
            title="Remove attachment"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 3. Video Preview */}
      {isVideo && (
        <div className={cn(styles.previewCard, styles.videoCard)}>
          <div className={styles.iconWrapper}>
            <Video size={18} />
          </div>
          <div className={styles.cardDetails}>
            <div className={styles.topInfo}>
              <span className={cn(styles.badgeLabel, styles.videoBadge)}>Video</span>
              {context.size ? <span className={styles.sizeLabel}>{formatBytes(context.size)}</span> : null}
            </div>
            <span className={styles.fileName} title={context.name}>
              {context.name}
            </span>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className={styles.removeBtn}
            aria-label="Remove attached video"
            title="Remove attachment"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 4. PDF Document Preview */}
      {isPdf && (
        <div className={cn(styles.previewCard, styles.pdfCard)}>
          <div className={styles.pdfIconWrapper}>
            <FileText size={18} />
          </div>
          <div className={styles.cardDetails}>
            <div className={styles.topInfo}>
              <span className={cn(styles.badgeLabel, styles.pdfBadge)}>PDF Document</span>
              {context.size ? <span className={styles.sizeLabel}>{formatBytes(context.size)}</span> : null}
            </div>
            <span className={styles.fileName} title={context.name}>
              {context.name}
            </span>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className={styles.removeBtn}
            aria-label="Remove attached PDF"
            title="Remove attachment"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 5. Library Context Item / Note Preview */}
      {isLibraryItem && !isImage && !isAudio && !isVideo && !isPdf && (
        <div className={cn(styles.previewCard, styles.libraryCard)}>
          <div className={styles.libraryIconWrapper}>
            <Bookmark size={18} />
          </div>
          <div className={styles.cardDetails}>
            <div className={styles.topInfo}>
              <span className={cn(styles.badgeLabel, styles.libraryBadge)}>
                {context.category || 'Library Context'}
              </span>
              <span className={styles.contextHint}>Knowledge Source</span>
            </div>
            <span className={styles.fileName} title={context.name}>
              {context.name}
            </span>
            {previewSnippet && (
              <p className={styles.snippetText} title={context.content}>
                &ldquo;{previewSnippet}&hellip;&rdquo;
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            className={styles.removeBtn}
            aria-label="Remove attached context"
            title="Remove attachment"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 6. Generic File Preview (Code/Text/Other) */}
      {!isImage && !isAudio && !isVideo && !isPdf && !isLibraryItem && (
        <div className={cn(styles.previewCard, styles.genericFileCard)}>
          <div className={styles.iconWrapper}>
            {context.name?.match(/\.(js|ts|jsx|tsx|py|json|html|css|sql|sh)$/i) ? (
              <FileCode size={18} />
            ) : (
              <FileText size={18} />
            )}
          </div>
          <div className={styles.cardDetails}>
            <div className={styles.topInfo}>
              <span className={styles.badgeLabel}>
                {context.type === 'file' ? 'Attached File' : 'Context'}
              </span>
              {context.size ? <span className={styles.sizeLabel}>{formatBytes(context.size)}</span> : null}
            </div>
            <span className={styles.fileName} title={context.name}>
              {context.name}
            </span>
            {previewSnippet && (
              <p className={styles.snippetText} title={context.content}>
                &ldquo;{previewSnippet}&hellip;&rdquo;
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            className={styles.removeBtn}
            aria-label="Remove attached file"
            title="Remove attachment"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

AttachedContextPreview.propTypes = {
  context: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string.isRequired,
    type: PropTypes.string,
    mimeType: PropTypes.string,
    data: PropTypes.string,
    size: PropTypes.number,
    content: PropTypes.string,
    category: PropTypes.string,
  }),
  onRemove: PropTypes.func.isRequired,
  className: PropTypes.string,
};

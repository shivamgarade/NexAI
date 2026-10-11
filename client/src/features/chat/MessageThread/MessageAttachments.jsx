import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  FileText,
  Video,
  Volume2,
  FileCode,
  ExternalLink,
  Download,
  Maximize2,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils/cn';
import styles from './MessageAttachments.module.scss';

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSafeSource(data, mimeType) {
  if (!data) return '';
  if (data.startsWith('data:') || data.startsWith('blob:') || data.startsWith('http')) {
    return data;
  }
  return `data:${mimeType || 'application/octet-stream'};base64,${data}`;
}

export function MessageAttachments({ attachments, className }) {
  const [activeLightbox, setActiveLightbox] = useState(null);

  if (!Array.isArray(attachments) || attachments.length === 0) {
    return null;
  }

  const handleOpenPdf = (srcUrl, fileName) => {
    try {
      const win = window.open();
      if (win) {
        win.document.title = fileName || 'PDF Document';
        const iframe = win.document.createElement('iframe');
        iframe.src = srcUrl;
        iframe.style.width = '100vw';
        iframe.style.height = '100vh';
        iframe.style.border = 'none';
        iframe.style.position = 'fixed';
        iframe.style.inset = '0';
        win.document.body.style.margin = '0';
        win.document.body.appendChild(iframe);
      }
    } catch {
      window.open(srcUrl, '_blank');
    }
  };

  return (
    <>
      <div className={cn(styles.attachmentsContainer, className)} role="region" aria-label="Attached files">
        {attachments.map((att, index) => {
          if (!att) return null;

          const key = att._id || `att-${index}-${att.name || 'file'}`;
          const isImage =
            att.type === 'image' ||
            att.mimeType?.startsWith('image/') ||
            att.name?.match(/\.(jpe?g|png|gif|webp|svg|bmp)$/i);
          const isVideo =
            att.type === 'video' ||
            att.mimeType?.startsWith('video/') ||
            att.name?.match(/\.(mp4|webm|ogg|mov)$/i);
          const isAudio =
            att.type === 'audio' ||
            att.mimeType?.startsWith('audio/') ||
            att.name?.match(/\.(mp3|wav|ogg|m4a|aac)$/i);
          const isPdf =
            att.type === 'pdf' ||
            att.mimeType === 'application/pdf' ||
            att.name?.toLowerCase().endsWith('.pdf');

          const srcUrl = getSafeSource(att.data, att.mimeType);

          // 1. Image Attachment
          if (isImage && srcUrl) {
            return (
              <div
                key={key}
                className={styles.imageCard}
                onClick={() => setActiveLightbox({ src: srcUrl, name: att.name, size: att.size })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveLightbox({ src: srcUrl, name: att.name, size: att.size });
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`View full image ${att.name || ''}`}
              >
                <img
                  src={srcUrl}
                  alt={att.name || 'Attached image'}
                  className={styles.imagePreview}
                  loading="lazy"
                />
                <div className={styles.imageHoverOverlay}>
                  <div className={styles.imageMeta}>
                    <span className={styles.imageName} title={att.name}>
                      {att.name || 'Attached image'}
                    </span>
                    {att.size ? <span className={styles.imageSize}>{formatBytes(att.size)}</span> : null}
                  </div>
                  <span className={styles.expandBadge}>
                    <Maximize2 size={12} />
                    <span>Expand</span>
                  </span>
                </div>
              </div>
            );
          }

          // 2. Video Attachment
          if (isVideo && srcUrl) {
            return (
              <div key={key} className={styles.videoCard}>
                <div className={styles.videoHeader}>
                  <div className={styles.videoHeaderLeft}>
                    <Video size={16} className={styles.videoIcon} />
                    <span className={styles.videoTitle} title={att.name}>
                      {att.name || 'Video'}
                    </span>
                  </div>
                  {att.size ? <span className={styles.videoSize}>{formatBytes(att.size)}</span> : null}
                </div>
                <video
                  controls
                  preload="metadata"
                  src={srcUrl}
                  className={styles.videoPlayer}
                  title={att.name || 'Attached video'}
                >
                  Your browser does not support HTML5 video.
                </video>
              </div>
            );
          }

          // 3. PDF Document Card
          if (isPdf) {
            return (
              <div key={key} className={styles.pdfCard}>
                <div className={styles.pdfLeft}>
                  <div className={styles.pdfIconWrapper}>
                    <FileText size={22} />
                  </div>
                  <div className={styles.pdfInfo}>
                    <span className={styles.pdfTitle} title={att.name}>
                      {att.name || 'Document.pdf'}
                    </span>
                    <div className={styles.pdfMeta}>
                      <span className={styles.pdfTag}>PDF</span>
                      {att.size ? <span>· {formatBytes(att.size)}</span> : null}
                    </div>
                  </div>
                </div>

                <div className={styles.pdfActions}>
                  {srcUrl && (
                    <button
                      type="button"
                      className={styles.pdfActionBtn}
                      onClick={() => handleOpenPdf(srcUrl, att.name)}
                      title="Open PDF in new tab"
                      aria-label="Open PDF document in new tab"
                    >
                      <ExternalLink size={15} />
                    </button>
                  )}
                  {srcUrl && (
                    <a
                      href={srcUrl}
                      download={att.name || 'document.pdf'}
                      className={styles.pdfActionBtn}
                      title="Download PDF"
                      aria-label="Download PDF document"
                    >
                      <Download size={15} />
                    </a>
                  )}
                </div>
              </div>
            );
          }

          // 4. Audio Attachment
          if (isAudio && srcUrl) {
            return (
              <div key={key} className={styles.audioCard}>
                <div className={styles.audioHeader}>
                  <div className={styles.audioHeaderLeft}>
                    <Volume2 size={16} className={styles.audioIcon} />
                    <span className={styles.audioTitle} title={att.name}>
                      {att.name || 'Audio clip'}
                    </span>
                  </div>
                  <div className={styles.audioHeaderRight}>
                    <span className={styles.audioBadge}>Audio</span>
                    {att.size ? (
                      <span className={styles.audioSize}>{formatBytes(att.size)}</span>
                    ) : null}
                  </div>
                </div>
                <audio controls src={srcUrl} className={styles.audioPlayer}>
                  Your browser does not support audio playback.
                </audio>
              </div>
            );
          }

          // 5. Generic File / Code / Document Card
          return (
            <div key={key} className={styles.genericCard}>
              <div className={styles.genericLeft}>
                <div className={styles.genericIconWrapper}>
                  {att.name?.match(/\.(js|ts|jsx|tsx|py|json|html|css|sql|sh|md)$/i) ? (
                    <FileCode size={18} />
                  ) : (
                    <FileText size={18} />
                  )}
                </div>
                <div className={styles.genericInfo}>
                  <span className={styles.genericTitle} title={att.name}>
                    {att.name || 'Attached file'}
                  </span>
                  <span className={styles.genericMeta}>
                    {att.type || 'File'}
                    {att.size ? ` · ${formatBytes(att.size)}` : ''}
                  </span>
                </div>
              </div>

              {srcUrl && (
                <a
                  href={srcUrl}
                  download={att.name || 'file'}
                  className={styles.pdfActionBtn}
                  title="Download file"
                  aria-label="Download file"
                >
                  <Download size={15} />
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox Preview Modal for Image Zoom */}
      {activeLightbox && (
        <Modal
          open={Boolean(activeLightbox)}
          onClose={() => setActiveLightbox(null)}
          title={activeLightbox.name || 'Image Preview'}
          className={styles.lightboxModal}
        >
          <div className={styles.lightboxBody}>
            <img
              src={activeLightbox.src}
              alt={activeLightbox.name || 'Full preview'}
              className={styles.lightboxImage}
            />
            <div className={styles.lightboxFooter}>
              <span className={styles.genericMeta}>
                {activeLightbox.size ? formatBytes(activeLightbox.size) : ''}
              </span>
              <a
                href={activeLightbox.src}
                download={activeLightbox.name || 'image'}
                className={styles.lightboxDownloadBtn}
              >
                <Download size={14} />
                <span>Download Image</span>
              </a>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

MessageAttachments.propTypes = {
  attachments: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string,
      name: PropTypes.string,
      type: PropTypes.string,
      mimeType: PropTypes.string,
      data: PropTypes.string,
      size: PropTypes.number,
      content: PropTypes.string,
    }),
  ),
  className: PropTypes.string,
};

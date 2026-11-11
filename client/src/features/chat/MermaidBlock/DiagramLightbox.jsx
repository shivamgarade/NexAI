import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import {
  Workflow,
  X,
  Copy,
  Check,
  Download,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Hand,
} from 'lucide-react';
import { toast } from '@/store/uiStore';
import { cn } from '@/lib/utils/cn';
import styles from './DiagramLightbox.module.scss';

export function DiagramLightbox({
  isOpen,
  onClose,
  svgContent,
  title = 'Architecture Diagram',
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [copiedSvg, setCopiedSvg] = useState(false);

  const viewportRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  // Reset zoom & pan whenever the lightbox is opened
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [isOpen]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Escape key listener to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle Ctrl + Wheel and standard wheel zooming inside the viewport
  useEffect(() => {
    if (!isOpen) return;
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;

    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      setZoom((prevZoom) => {
        const next = Math.min(5.0, Math.max(0.2, Number((prevZoom * factor).toFixed(2))));
        return next;
      });
    };

    viewportEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      viewportEl.removeEventListener('wheel', handleWheel);
    };
  }, [isOpen]);

  // Global mouseup to release drag anywhere in window
  useEffect(() => {
    if (!isDragging) return;
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e) => {
    // Only primary (left) button initiates dragging
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + deltaX,
      y: panStartRef.current.y + deltaY,
    });
  };

  // Touch gesture support for mobile / tablets
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      dragStartRef.current = { x: touch.clientX, y: touch.clientY };
      panStartRef.current = { ...pan };
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStartRef.current.x;
    const deltaY = touch.clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + deltaX,
      y: panStartRef.current.y + deltaY,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setZoom((z) => Math.min(5.0, Number((z * 1.25).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.2, Number((z * 0.8).toFixed(2))));
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleCopySvg = async (e) => {
    e.stopPropagation();
    if (!svgContent) return;
    try {
      await navigator.clipboard.writeText(svgContent);
      setCopiedSvg(true);
      toast.success('Diagram SVG copied to clipboard');
      setTimeout(() => setCopiedSvg(false), 2000);
    } catch {
      toast.error('Failed to copy SVG');
    }
  };

  const handleDownloadSvg = (e) => {
    e.stopPropagation();
    if (!svgContent) return;
    try {
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexai-diagram-${Date.now()}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Diagram SVG downloaded');
    } catch {
      toast.error('Failed to download SVG');
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`Interactive Diagram View: ${title}`}
    >
      {/* Top Floating Glass Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.badge}>
            <Workflow size={14} />
            <span>Architecture Diagram</span>
          </span>
          <span className={styles.titleText} title={title}>
            {title}
          </span>
        </div>

        {/* Center: Zoom Controls & Percentage Indicator */}
        <div className={styles.headerCenter}>
          <div className={styles.zoomControls}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={handleZoomOut}
              title="Zoom out"
              aria-label="Zoom out"
              disabled={zoom <= 0.2}
            >
              <ZoomOut size={13} />
            </button>
            <button
              type="button"
              className={cn(styles.zoomPill, (zoom !== 1 || pan.x !== 0 || pan.y !== 0) && styles.isModified)}
              onClick={handleReset}
              title="Click to reset zoom & position (100%)"
              aria-label="Reset zoom and position"
            >
              <span>{Math.round(zoom * 100)}%</span>
              {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
                <RotateCcw size={10} className={styles.resetIcon} />
              )}
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={handleZoomIn}
              title="Zoom in"
              aria-label="Zoom in"
              disabled={zoom >= 5.0}
            >
              <ZoomIn size={13} />
            </button>
          </div>
        </div>

        {/* Right: Actions and Close Button */}
        <div className={styles.headerRight}>
          <button
            type="button"
            className={cn(styles.actionBtn, copiedSvg && styles.copied)}
            onClick={handleCopySvg}
            title={copiedSvg ? 'Copied SVG to clipboard' : 'Copy SVG'}
            aria-label="Copy SVG XML"
          >
            {copiedSvg ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleDownloadSvg}
            title="Download SVG file"
            aria-label="Download SVG"
          >
            <Download size={14} />
          </button>
          <button
            type="button"
            className={cn(styles.actionBtn, styles.closeBtn)}
            onClick={onClose}
            title="Close interactive view (Esc)"
            aria-label="Close interactive view"
          >
            <X size={17} />
          </button>
        </div>
      </header>

      {/* Main Interactive Pannable / Zoomable Viewport with Grab Cursor */}
      <div
        ref={viewportRef}
        className={cn(styles.viewport, isDragging && styles.isDragging)}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={styles.diagramCanvas}
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>

      {/* Bottom Floating Status & Navigation Guide */}
      <footer className={styles.footerHint}>
        <Hand size={13} className={styles.handIcon} />
        <span>Click & drag to pan • Ctrl + Wheel to zoom • Esc to close</span>
      </footer>
    </div>,
    document.body
  );
}

DiagramLightbox.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  svgContent: PropTypes.string,
  title: PropTypes.string,
};

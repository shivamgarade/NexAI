import React, { useState, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import mermaid from 'mermaid';
import {
  Workflow,
  Code2,
  Copy,
  Check,
  Download,
  Bookmark,
  AlertCircle,
  Eye,
  Maximize2,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useLibraryStore } from '@/store/libraryStore';
import { toast } from '@/store/uiStore';
import { cn } from '@/lib/utils/cn';
import { DiagramLightbox } from './DiagramLightbox';
import styles from './MermaidBlock.module.scss';

let mermaidInitialized = false;
const svgCache = new Map();

function initMermaid(isDark) {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    suppressErrorRendering: true,
    theme: isDark ? 'dark' : 'default',
    themeVariables: isDark
      ? {
          darkMode: true,
          background: 'transparent',
          mainBkg: '#1c2029',
          nodeBorder: '#3b4252',
          textColor: '#eceef2',
          lineColor: '#8b5cf6',
          primaryColor: '#8b5cf6',
          primaryTextColor: '#ffffff',
          primaryBorderColor: '#a78bfa',
          secondaryColor: '#161a22',
          tertiaryColor: '#2a2f3a',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }
      : {
          darkMode: false,
          background: 'transparent',
          mainBkg: '#f7f7f9',
          nodeBorder: '#d9dce3',
          textColor: '#0f1217',
          lineColor: '#7c3aed',
          primaryColor: '#7c3aed',
          primaryTextColor: '#ffffff',
          primaryBorderColor: '#6d28d9',
          secondaryColor: '#eceef2',
          tertiaryColor: '#e2e8f0',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        },
  });
  mermaidInitialized = true;
}

export const MermaidBlock = React.memo(function MermaidBlock({ chart = '', isStreaming = false }) {
  const { isDark } = useTheme();
  const cleanChart = useMemo(() => (chart || '').trim(), [chart]);
  const cacheKey = `${isDark ? 'dark' : 'light'}::${cleanChart}`;

  const [svgContent, setSvgContent] = useState(() => svgCache.get(cacheKey) || '');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(() => !svgCache.has(cacheKey) && Boolean(cleanChart));
  const [viewMode, setViewMode] = useState('diagram');
  const [copiedSvg, setCopiedSvg] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const containerRef = useRef(null);
  const renderCountRef = useRef(0);

  // Extract human-friendly title from top diagram comments (e.g. %% Title)
  const cleanTitle = useMemo(() => {
    const lines = cleanChart.split('\n');
    const firstComment = lines.find((l) => l.trim().startsWith('%%')) || '';
    if (firstComment) {
      return firstComment.replace(/^%%\s*/, '').trim().slice(0, 50);
    }
    // Infer title from first diagram directive (e.g. gantt, classDiagram, etc.)
    const firstDirective = lines[0]?.trim() || '';
    if (firstDirective.startsWith('gantt')) return 'Gantt Timeline Chart';
    if (firstDirective.startsWith('classDiagram')) return 'Class Relationship Diagram';
    if (firstDirective.startsWith('sequenceDiagram')) return 'Sequence Interaction Flow';
    if (firstDirective.startsWith('stateDiagram')) return 'State Transition Diagram';
    if (firstDirective.startsWith('erDiagram')) return 'Entity-Relationship Model';
    return 'Architecture Diagram';
  }, [cleanChart]);

  // Re-initialize mermaid whenever active theme toggles
  useEffect(() => {
    initMermaid(isDark);
  }, [isDark]);

  useEffect(() => {
    let isMounted = true;

    if (!cleanChart) {
      setSvgContent('');
      setError(null);
      setIsLoading(false);
      return;
    }

    // Check if SVG has already been compiled and cached
    if (svgCache.has(cacheKey)) {
      setSvgContent(svgCache.get(cacheKey));
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!mermaidInitialized) {
      initMermaid(isDark);
    }

    setIsLoading(true);

    // Debounce rendering slightly during rapid streaming token emissions
    const timer = setTimeout(async () => {
      renderCountRef.current += 1;
      const renderId = `nexai-mermaid-${Date.now()}-${renderCountRef.current}`;

      try {
        // First validate syntax with parse
        await mermaid.parse(cleanChart);

        // Render SVG diagram
        const { svg } = await mermaid.render(renderId, cleanChart);

        if (isMounted) {
          svgCache.set(cacheKey, svg);
          setSvgContent(svg);
          setError(null);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          // Clean up any lingering temporary DOM nodes mermaid might inject on parse failure
          const badNode = document.getElementById(renderId);
          if (badNode) badNode.remove();
          const dNode = document.getElementById(`d${renderId}`);
          if (dNode) dNode.remove();

          // During streaming, syntax is naturally incomplete; do not treat as fatal error
          if (!isStreaming) {
            setError(err?.message || 'Invalid Mermaid syntax');
          }
          setIsLoading(false);
        }
      }
    }, isStreaming ? 250 : 30);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [cleanChart, cacheKey, isStreaming, isDark]);

  const handleCopySvg = async (e) => {
    e?.stopPropagation();
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

  const handleCopyCode = async (e) => {
    e?.stopPropagation();
    if (!chart) return;
    try {
      await navigator.clipboard.writeText(chart);
      setCopiedCode(true);
      toast.success('Mermaid code copied to clipboard');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  const handleDownloadSvg = (e) => {
    e?.stopPropagation();
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

  const handleSaveToLibrary = (e) => {
    e?.stopPropagation();
    useLibraryStore.getState().openAddModal({
      type: 'note',
      title: cleanTitle.slice(0, 50),
      content: `\`\`\`mermaid\n${chart}\n\`\`\``,
      tags: ['diagram', 'architecture', 'mermaid'],
    });
  };

  return (
    <div className={styles.container}>
      {/* Header Toolbar */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.badge}>
            <Workflow size={13} />
            <span>Architecture Diagram</span>
          </span>

          <div className={styles.tabGroup} role="tablist">
            <button
              type="button"
              className={cn(styles.tabBtn, viewMode === 'diagram' && styles.active)}
              onClick={() => setViewMode('diagram')}
              role="tab"
              aria-selected={viewMode === 'diagram'}
            >
              <Eye size={12} />
              <span>Diagram</span>
            </button>
            <button
              type="button"
              className={cn(styles.tabBtn, viewMode === 'code' && styles.active)}
              onClick={() => setViewMode('code')}
              role="tab"
              aria-selected={viewMode === 'code'}
            >
              <Code2 size={12} />
              <span>Code</span>
            </button>
          </div>
        </div>

        <div className={styles.headerRight}>
          {viewMode === 'diagram' && svgContent && (
            <>
              {/* Expand to Fullscreen Interactive View Button */}
              <button
                type="button"
                className={styles.expandBtn}
                onClick={() => setIsLightboxOpen(true)}
                title="Open interactive view (Pan & Zoom)"
                aria-label="Open interactive view"
              >
                <Maximize2 size={13} />
                <span>Expand</span>
              </button>

              <span className={styles.divider} aria-hidden="true" />

              {/* Minimal Icon Actions */}
              <div className={styles.actionGroup}>
                <button
                  type="button"
                  className={cn(styles.iconBtn, copiedSvg && styles.copied)}
                  onClick={handleCopySvg}
                  title={copiedSvg ? 'Copied SVG to clipboard' : 'Copy SVG XML'}
                  aria-label="Copy SVG XML"
                >
                  {copiedSvg ? <Check size={13} /> : <Copy size={13} />}
                </button>

                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={handleDownloadSvg}
                  title="Export as SVG file"
                  aria-label="Export as SVG file"
                >
                  <Download size={13} />
                </button>

                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={handleSaveToLibrary}
                  title="Save diagram to Library"
                  aria-label="Save diagram to Library"
                >
                  <Bookmark size={13} />
                </button>
              </div>
            </>
          )}

          {viewMode === 'code' && (
            <button
              type="button"
              className={styles.codeCopyBtn}
              onClick={handleCopyCode}
              title="Copy raw Mermaid code"
            >
              {copiedCode ? (
                <>
                  <Check size={13} className={styles.checkIcon} />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Syntax Error Notice (if parsing fails after streaming ends) */}
      {error && !isStreaming && (
        <div className={styles.errorBanner}>
          <div className={styles.errorInfo}>
            <AlertCircle size={14} />
            <span>Diagram syntax could not be compiled.</span>
          </div>
          <button
            type="button"
            className={styles.viewCodeBtn}
            onClick={() => setViewMode('code')}
          >
            Inspect Source
          </button>
        </div>
      )}

      {/* Canvas or Code View */}
      {viewMode === 'diagram' ? (
        <div
          className={cn(styles.canvasWrapper, svgContent && styles.isClickable)}
          ref={containerRef}
          onClick={svgContent ? () => setIsLightboxOpen(true) : undefined}
          role={svgContent ? 'button' : undefined}
          tabIndex={svgContent ? 0 : undefined}
          aria-label={svgContent ? 'Click to open interactive diagram (Pan & Zoom)' : undefined}
          onKeyDown={svgContent ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsLightboxOpen(true);
            }
          } : undefined}
          title={svgContent ? 'Click to open interactive diagram (Pan & Zoom)' : undefined}
        >
          {isLoading && !svgContent ? (
            <div className={styles.loadingPlaceholder}>
              <div className={styles.spinner} />
              <span>
                {isStreaming
                  ? 'Generating architecture diagram...'
                  : 'Compiling visual model...'}
              </span>
            </div>
          ) : svgContent ? (
            <>
              <div
                className={styles.diagramCanvas}
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
              <div className={styles.hoverPrompt} aria-hidden="true">
                <Maximize2 size={12} />
                <span>Click to expand & interact</span>
              </div>
            </>
          ) : (
            <pre className={styles.codeView}>
              <code>{chart}</code>
            </pre>
          )}
        </div>
      ) : (
        <pre className={styles.codeView}>
          <code>{chart}</code>
        </pre>
      )}

      {/* Interactive Lightbox Popup with Hand Pan & Wheel Zoom */}
      <DiagramLightbox
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        svgContent={svgContent}
        title={cleanTitle}
        rawChart={chart}
      />
    </div>
  );
});

MermaidBlock.propTypes = {
  chart: PropTypes.string,
  isStreaming: PropTypes.bool,
};

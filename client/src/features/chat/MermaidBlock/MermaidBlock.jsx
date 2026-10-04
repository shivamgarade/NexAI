import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import mermaid from 'mermaid';
import {
  Workflow,
  Code2,
  Copy,
  Check,
  Download,
  Bookmark,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useLibraryStore } from '@/store/libraryStore';
import { toast } from '@/store/uiStore';
import { cn } from '@/lib/utils/cn';
import styles from './MermaidBlock.module.scss';

let mermaidInitialized = false;

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

export function MermaidBlock({ chart = '', isStreaming = false }) {
  const { isDark } = useTheme();
  const [svgContent, setSvgContent] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('diagram');
  const [zoom, setZoom] = useState(1);
  const [copiedSvg, setCopiedSvg] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const containerRef = useRef(null);
  const renderCountRef = useRef(0);

  // Re-initialize mermaid whenever active theme toggles
  useEffect(() => {
    initMermaid(isDark);
  }, [isDark]);

  useEffect(() => {
    let isMounted = true;
    const cleanChart = (chart || '').trim();

    if (!cleanChart) {
      setSvgContent('');
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!mermaidInitialized) {
      initMermaid(isDark);
    }

    // Debounce rendering slightly during rapid streaming token emissions
    const timer = setTimeout(async () => {
      renderCountRef.current += 1;
      const renderId = `nexai-mermaid-${Date.now()}-${renderCountRef.current}`;

      try {
        setIsLoading(true);

        // First validate syntax with parse
        await mermaid.parse(cleanChart);

        // Render SVG diagram
        const { svg } = await mermaid.render(renderId, cleanChart);

        if (isMounted) {
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
    }, isStreaming ? 250 : 50);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [chart, isStreaming, isDark]);

  const handleZoomIn = () => {
    setZoom((z) => Math.min(2.5, +(z + 0.2).toFixed(1)));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(1)));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const handleCopySvg = async () => {
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

  const handleCopyCode = async () => {
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

  const handleDownloadSvg = () => {
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

  const handleSaveToLibrary = () => {
    const lines = chart.trim().split('\n');
    const firstComment = lines.find((l) => l.trim().startsWith('%%')) || '';
    const cleanTitle = firstComment
      ? firstComment.replace(/^%%\s*/, '').trim()
      : 'Architecture Diagram';

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
            <div className={styles.zoomControls} title="Zoom diagram">
              <button
                type="button"
                className={styles.zoomBtn}
                onClick={handleZoomOut}
                aria-label="Zoom out"
                disabled={zoom <= 0.5}
              >
                <ZoomOut size={12} />
              </button>
              <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                className={styles.zoomBtn}
                onClick={handleZoomIn}
                aria-label="Zoom in"
                disabled={zoom >= 2.5}
              >
                <ZoomIn size={12} />
              </button>
              {zoom !== 1 && (
                <button
                  type="button"
                  className={styles.zoomBtn}
                  onClick={handleResetZoom}
                  aria-label="Reset zoom"
                  title="Reset zoom to 100%"
                >
                  <RotateCcw size={12} />
                </button>
              )}
            </div>
          )}

          {viewMode === 'diagram' && svgContent && (
            <>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={handleCopySvg}
                title="Copy SVG XML to clipboard"
              >
                {copiedSvg ? (
                  <>
                    <Check size={13} className={styles.checkIcon} />
                    <span>Copied SVG</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy SVG</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className={styles.actionBtn}
                onClick={handleDownloadSvg}
                title="Download as SVG file"
              >
                <Download size={13} />
                <span>Export SVG</span>
              </button>
            </>
          )}

          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleSaveToLibrary}
            title="Save diagram snippet to Library"
          >
            <Bookmark size={13} />
            <span>Save to Library</span>
          </button>

          {viewMode === 'code' && (
            <button
              type="button"
              className={styles.actionBtn}
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
        <div className={styles.canvasWrapper} ref={containerRef}>
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
            <div
              className={styles.diagramCanvas}
              style={{ transform: `scale(${zoom})` }}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
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
    </div>
  );
}

MermaidBlock.propTypes = {
  chart: PropTypes.string,
  isStreaming: PropTypes.bool,
};

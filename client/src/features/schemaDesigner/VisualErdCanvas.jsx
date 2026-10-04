import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Network,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Table,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Link2,
} from 'lucide-react';
import { useSchemaStore } from '@/store/schemaStore';
import { MermaidBlock } from '@/features/chat/MermaidBlock';
import { toast } from '@/components/ui/Toast';
import styles from './VisualErdCanvas.module.scss';

export function VisualErdCanvas() {
  const { currentSchema, isLoading, entityPositions, setEntityPositions } = useSchemaStore();
  const [renderMode, setRenderMode] = useState('interactive'); // 'interactive' | 'mermaid'
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectingSource, setConnectingSource] = useState(null);
  const [manualLinks, setManualLinks] = useState([]);

  const draggingRef = useRef(null);
  const canvasRef = useRef(null);

  // Compute balanced initial positions for entities if not saved
  useEffect(() => {
    if (!currentSchema?.entities?.length) return;
    const newPositions = { ...entityPositions };
    let hasNew = false;

    const cols = Math.min(3, Math.ceil(Math.sqrt(currentSchema.entities.length)));
    const colWidth = 320;
    const rowHeight = 310;

    currentSchema.entities.forEach((entity, index) => {
      if (!newPositions[entity.name]) {
        const col = index % cols;
        const row = Math.floor(index / cols);
        newPositions[entity.name] = {
          x: 40 + col * colWidth,
          y: 40 + row * rowHeight,
        };
        hasNew = true;
      }
    });

    if (hasNew) {
      setEntityPositions(newPositions);
    }
  }, [currentSchema, entityPositions, setEntityPositions]);

  // Extract all relationships (AI detected + manual connections)
  const connections = useMemo(() => {
    if (!currentSchema?.entities?.length) return [];
    const list = [];

    currentSchema.entities.forEach((entity) => {
      (entity.fields || []).forEach((field) => {
        if (field.isForeignKey || field.references || field.name.toLowerCase().endsWith('id')) {
          // Identify target entity
          let targetName = '';
          if (field.references) {
            targetName = field.references.split('.')[0];
          } else if (field.name.toLowerCase().endsWith('id')) {
            const rawPrefix = field.name.replace(/_?id$/i, '');
            const match = currentSchema.entities.find(
              (e) => e.name.toLowerCase() === rawPrefix.toLowerCase()
            );
            if (match) targetName = match.name;
          }

          if (targetName && targetName !== entity.name) {
            list.push({
              id: `${entity.name}-${field.name}->${targetName}`,
              source: entity.name,
              sourceField: field.name,
              target: targetName,
              cardinality: '1 : N',
            });
          }
        }
      });
    });

    // Add any manual connections created by user
    manualLinks.forEach((ml) => {
      if (!list.some((l) => l.source === ml.source && l.target === ml.target)) {
        list.push(ml);
      }
    });

    return list;
  }, [currentSchema, manualLinks]);

  // Handle entity card dragging
  const handleMouseDown = useCallback((e, entityName) => {
    if (e.button !== 0) return; // primary click only
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const currentPos = entityPositions[entityName] || { x: 50, y: 50 };

    draggingRef.current = {
      entityName,
      startX,
      startY,
      origX: currentPos.x,
      origY: currentPos.y,
    };

    const handleMouseMove = (moveEvent) => {
      if (!draggingRef.current) return;
      const dx = (moveEvent.clientX - draggingRef.current.startX) / zoom;
      const dy = (moveEvent.clientY - draggingRef.current.startY) / zoom;

      setEntityPositions({
        [draggingRef.current.entityName]: {
          x: Math.max(10, Math.round(draggingRef.current.origX + dx)),
          y: Math.max(10, Math.round(draggingRef.current.origY + dy)),
        },
      });
    };

    const handleMouseUp = () => {
      draggingRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [entityPositions, setEntityPositions, zoom]);

  // Handle entity click in connection mode
  const handleEntityCardClick = (entityName) => {
    if (!connectingSource) {
      setConnectingSource(entityName);
      toast.info(`Selected ${entityName}. Now click target entity to link.`);
    } else if (connectingSource !== entityName) {
      setManualLinks((prev) => [
        ...prev,
        {
          id: `manual-${connectingSource}->${entityName}`,
          source: connectingSource,
          sourceField: 'relation',
          target: entityName,
          cardinality: '1 : N',
        },
      ]);
      toast.success(`Connected ${connectingSource} → ${entityName}`);
      setConnectingSource(null);
    } else {
      setConnectingSource(null);
    }
  };

  const handleCopyMermaid = async () => {
    if (!currentSchema?.mermaidErDiagram) return;
    try {
      await navigator.clipboard.writeText(currentSchema.mermaidErDiagram);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied Mermaid ERD syntax');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleResetLayout = () => {
    if (!currentSchema?.entities?.length) return;
    const resetPositions = {};
    const cols = Math.min(3, Math.ceil(Math.sqrt(currentSchema.entities.length)));
    currentSchema.entities.forEach((entity, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      resetPositions[entity.name] = {
        x: 40 + col * 320,
        y: 40 + row * 310,
      };
    });
    setEntityPositions(resetPositions);
    setZoom(1);
    toast.success('Auto-arranged entity layout');
  };

  return (
    <div className={styles.canvasContainer}>
      <div className={styles.topBar}>
        <div className={styles.titleArea}>
          <Network size={16} className="text-accent" />
          <h4>Architecture & Entity Relationships</h4>
          {currentSchema && (
            <div className={styles.badgeGroup}>
              <span className={styles.metaBadge}>
                {currentSchema.entities?.length || 0} Entities
              </span>
              <span className={styles.metaBadge}>
                {connections.length} Relationships
              </span>
            </div>
          )}
        </div>

        {currentSchema && (
          <div className={styles.controls}>
            {/* View Mode Toggle: Interactive Canvas vs Mermaid SVG */}
            <div className={styles.modeToggle}>
              <button
                type="button"
                className={`${styles.btnAction} ${renderMode === 'interactive' ? styles.active : ''}`}
                onClick={() => setRenderMode('interactive')}
                title="Interactive draggable entity nodes with smooth bezier relations"
              >
                <Sparkles size={12} />
                <span>Interactive</span>
              </button>
              <button
                type="button"
                className={`${styles.btnAction} ${renderMode === 'mermaid' ? styles.active : ''}`}
                onClick={() => setRenderMode('mermaid')}
                title="Mermaid.js diagram rendering"
              >
                <Network size={12} />
                <span>Mermaid View</span>
              </button>
            </div>

            <button
              type="button"
              className={styles.btnAction}
              onClick={handleCopyMermaid}
              title="Copy raw Mermaid code"
            >
              {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              className={styles.btnAction}
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>
        )}
      </div>

      <div className={styles.viewportContainer} ref={canvasRef}>
        {currentSchema?.entities?.length ? (
          renderMode === 'interactive' ? (
            <>
              {/* Floating Zoom & Tool Controls */}
              <div className={styles.floatingCanvasToolbar}>
                <button
                  type="button"
                  className={styles.canvasToolBtn}
                  onClick={() => setZoom((z) => Math.min(2, +(z + 0.15).toFixed(2)))}
                  title="Zoom In"
                >
                  <ZoomIn size={14} />
                </button>
                <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  className={styles.canvasToolBtn}
                  onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))}
                  title="Zoom Out"
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  type="button"
                  className={styles.canvasToolBtn}
                  onClick={handleResetLayout}
                  title="Reset Zoom & Auto-Arrange Grid"
                >
                  <RotateCcw size={13} />
                </button>
                <div style={{ width: 1, height: 16, background: 'var(--color-border)', margin: '0 2px' }} />
                <button
                  type="button"
                  className={`${styles.canvasToolBtn} ${connectingSource ? styles.active : ''}`}
                  onClick={() => setConnectingSource(connectingSource ? null : 'SELECT')}
                  title="Connect tool: Click an entity then click another to add relationship"
                >
                  <Link2 size={14} />
                </button>
              </div>

              {/* Interactive Canvas Workspace */}
              <div
                className={styles.interactiveCanvas}
                style={{ transform: `scale(${zoom})` }}
              >
                {/* SVG Connections Overlay */}
                <svg className={styles.svgConnectionsLayer} width="4000" height="3000">
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="8"
                      refX="9"
                      refY="4"
                      orient="auto"
                    >
                      <polygon
                        points="0 0, 10 4, 0 8"
                        fill="var(--color-accent)"
                      />
                    </marker>
                  </defs>

                  {connections.map((conn) => {
                    const srcPos = entityPositions[conn.source] || { x: 50, y: 50 };
                    const tgtPos = entityPositions[conn.target] || { x: 400, y: 50 };

                    const cardW = 260;
                    const cardH = 140;

                    // Compute clean anchor connection coordinates
                    const srcCenterX = srcPos.x + cardW / 2;
                    const srcCenterY = srcPos.y + cardH / 2;
                    const tgtCenterX = tgtPos.x + cardW / 2;
                    const tgtCenterY = tgtPos.y + cardH / 2;

                    let startX, startY, endX, endY;

                    if (srcCenterX < tgtCenterX) {
                      startX = srcPos.x + cardW;
                      startY = srcCenterY;
                      endX = tgtPos.x;
                      endY = tgtCenterY;
                    } else {
                      startX = srcPos.x;
                      startY = srcCenterY;
                      endX = tgtPos.x + cardW;
                      endY = tgtCenterY;
                    }

                    const dx = Math.max(50, Math.abs(endX - startX) * 0.45);
                    const pathData = `M ${startX} ${startY} C ${startX < endX ? startX + dx : startX - dx} ${startY}, ${startX < endX ? endX - dx : endX + dx} ${endY}, ${endX} ${endY}`;
                    const midX = (startX + endX) / 2;
                    const midY = (startY + endY) / 2;

                    return (
                      <g key={conn.id}>
                        <path
                          d={pathData}
                          className={styles.connectionCurve}
                          markerEnd="url(#arrowhead)"
                        />
                        {/* Cardinality Badge on Midpoint */}
                        <rect
                          x={midX - 22}
                          y={midY - 10}
                          width={44}
                          height={20}
                          className={styles.cardinalityBadge}
                        />
                        <text
                          x={midX}
                          y={midY}
                          className={styles.cardinalityText}
                        >
                          {conn.cardinality}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Render Draggable Entity Cards */}
                {currentSchema.entities.map((entity) => {
                  const pos = entityPositions[entity.name] || { x: 50, y: 50 };
                  const isSource = connectingSource === entity.name;

                  return (
                    <div
                      key={entity.name}
                      className={`${styles.entityCard} ${isSource ? styles.isConnectingSource : ''}`}
                      style={{
                        left: `${pos.x}px`,
                        top: `${pos.y}px`,
                      }}
                      onClick={() => {
                        if (connectingSource) {
                          handleEntityCardClick(entity.name);
                        }
                      }}
                    >
                      <div
                        className={styles.entityCardHeader}
                        onMouseDown={(e) => handleMouseDown(e, entity.name)}
                      >
                        <div className={styles.entityName}>
                          <Table size={13} className="text-accent" />
                          <span>{entity.name}</span>
                        </div>
                        <span className={styles.entityFieldCount}>
                          {entity.fields?.length || 0} cols
                        </span>
                      </div>

                      <div className={styles.fieldList}>
                        {(entity.fields || []).map((field) => (
                          <div key={field.name} className={styles.fieldRow}>
                            <div className={styles.fieldLeft}>
                              <span className={styles.fieldName}>{field.name}</span>
                            </div>
                            <div className={styles.fieldRight}>
                              <span className={styles.fieldType}>{field.type}</span>
                              {field.isPrimary && (
                                <span className={styles.tagPk}>PK</span>
                              )}
                              {field.isForeignKey && (
                                <span className={styles.tagFk}>FK</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ height: '100%', overflow: 'auto' }}>
              <MermaidBlock
                chart={currentSchema.mermaidErDiagram}
                isStreaming={isLoading}
              />
            </div>
          )
        ) : (
          <div className={styles.emptyArea}>
            <Network size={44} className={styles.emptyIcon} />
            <h4>No Active Data Model</h4>
            <p>
              Type domain requirements in the prompt bar below or choose a starter template to
              synthesize an interactive entity relationship canvas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

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
  Key,
  X,
} from 'lucide-react';
import { useSchemaStore } from '@/store/schemaStore';
import { MermaidBlock } from '@/features/chat/MermaidBlock';
import { toast } from '@/components/ui/Toast';
import styles from './VisualErdCanvas.module.scss';

export function VisualErdCanvas() {
  const { currentSchema, isLoading, entityPositions, setEntityPositions, updateCodeOutput } =
    useSchemaStore();
  const [renderMode, setRenderMode] = useState('interactive'); // 'interactive' | 'mermaid'
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectingField, setConnectingField] = useState(null); // { entityName, fieldName }
  const [manualLinks, setManualLinks] = useState([]);

  const draggingRef = useRef(null);
  const canvasRef = useRef(null);

  // Compute balanced initial positions for entities if not set
  useEffect(() => {
    if (!currentSchema?.entities?.length) return;
    const newPositions = { ...entityPositions };
    let hasNew = false;

    const cols = Math.min(3, Math.ceil(Math.sqrt(currentSchema.entities.length)));
    const colWidth = 320;
    const rowHeight = 280;

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

  // Extract all relationships with specific field names
  const connections = useMemo(() => {
    if (!currentSchema?.entities?.length) return [];
    const list = [];

    currentSchema.entities.forEach((entity) => {
      (entity.fields || []).forEach((field) => {
        if (field.isForeignKey || field.references || field.name.toLowerCase().endsWith('id')) {
          // Identify target entity and target field
          let targetName = '';
          let targetField = 'id';

          if (field.references) {
            const parts = field.references.split('.');
            targetName = parts[0];
            if (parts[1]) targetField = parts[1];
          } else if (field.name.toLowerCase().endsWith('id')) {
            const rawPrefix = field.name.replace(/_?id$/i, '');
            const match = currentSchema.entities.find(
              (e) => e.name.toLowerCase() === rawPrefix.toLowerCase()
            );
            if (match) targetName = match.name;
          }

          if (targetName && targetName !== entity.name) {
            list.push({
              id: `${entity.name}.${field.name}->${targetName}.${targetField}`,
              source: entity.name,
              sourceField: field.name,
              target: targetName,
              targetField,
              cardinality: '1 : N',
            });
          }
        }
      });
    });

    // Merge any user-drawn manual connections
    manualLinks.forEach((ml) => {
      if (!list.some((l) => l.source === ml.source && l.sourceField === ml.sourceField && l.target === ml.target)) {
        list.push(ml);
      }
    });

    return list;
  }, [currentSchema, manualLinks]);

  // Handle entity card dragging
  const handleMouseDown = useCallback(
    (e, entityName) => {
      if (e.button !== 0) return;
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
    },
    [entityPositions, setEntityPositions, zoom]
  );

  // Field port connection handler
  const handlePortClick = (entityName, fieldName) => {
    if (!connectingField) {
      setConnectingField({ entityName, fieldName });
      toast.info(`Port selected: ${entityName}.${fieldName}. Click a target key to connect.`);
    } else if (connectingField.entityName === entityName && connectingField.fieldName === fieldName) {
      setConnectingField(null);
    } else {
      // Connect source to target
      const newLink = {
        id: `link-${connectingField.entityName}.${connectingField.fieldName}->${entityName}.${fieldName}`,
        source: connectingField.entityName,
        sourceField: connectingField.fieldName,
        target: entityName,
        targetField: fieldName,
        cardinality: '1 : N',
      };

      setManualLinks((prev) => [...prev, newLink]);

      // Update real-time schema in state
      toast.success(
        `Linked ${connectingField.entityName}.${connectingField.fieldName} → ${entityName}.${fieldName}`
      );

      // Real-time sync: update code comments in active code output
      if (currentSchema?.codeOutputs?.mongoose) {
        const comment = `\n// Relation: ${connectingField.entityName}.${connectingField.fieldName} -> ${entityName}.${fieldName}`;
        updateCodeOutput('mongoose', `${currentSchema.codeOutputs.mongoose}${comment}`);
      }

      setConnectingField(null);
    }
  };

  const handleDeleteConnection = (connId) => {
    setManualLinks((prev) => prev.filter((l) => l.id !== connId));
    toast.info('Connection removed');
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
        y: 40 + row * 280,
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
                title="Interactive node view with field-to-field bezier connectors"
              >
                <Sparkles size={12} />
                <span>Interactive</span>
              </button>
              <button
                type="button"
                className={`${styles.btnAction} ${renderMode === 'mermaid' ? styles.active : ''}`}
                onClick={() => setRenderMode('mermaid')}
                title="Mermaid diagram format"
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
        {/* Floating helper hint during connection mode */}
        {connectingField && (
          <div className={styles.connectionHelpHint}>
            <Link2 size={12} />
            <span>
              Connecting from <strong>{connectingField.entityName}.{connectingField.fieldName}</strong>... click target key
            </span>
            <button
              type="button"
              className="text-text-muted hover:text-text-primary ml-1"
              onClick={() => setConnectingField(null)}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {currentSchema?.entities?.length ? (
          renderMode === 'interactive' ? (
            <>
              {/* Floating Canvas Controls */}
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
              </div>

              {/* Interactive Draggable Canvas */}
              <div
                className={styles.interactiveCanvas}
                style={{ transform: `scale(${zoom})` }}
              >
                {/* SVG Connections Overlay with Field-to-Field Bezier Curves */}
                <svg className={styles.svgConnectionsLayer} width="4000" height="3000">
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="9"
                      markerHeight="7"
                      refX="8"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon
                        points="0 0, 9 3.5, 0 7"
                        fill="var(--color-accent)"
                      />
                    </marker>
                  </defs>

                  {connections.map((conn) => {
                    const srcEntity = currentSchema.entities.find((e) => e.name === conn.source);
                    const tgtEntity = currentSchema.entities.find((e) => e.name === conn.target);

                    if (!srcEntity || !tgtEntity) return null;

                    const srcPos = entityPositions[conn.source] || { x: 50, y: 50 };
                    const tgtPos = entityPositions[conn.target] || { x: 400, y: 50 };

                    // Find field index within each entity card
                    const srcFieldIdx = Math.max(
                      0,
                      srcEntity.fields.findIndex((f) => f.name === conn.sourceField)
                    );
                    const tgtFieldIdx = Math.max(
                      0,
                      tgtEntity.fields.findIndex(
                        (f) => f.name === conn.targetField || f.isPrimary
                      )
                    );

                    const cardW = 260;
                    const headerH = 38;
                    const rowH = 28;

                    // Calculate precise field anchor Y coordinates
                    const srcY = srcPos.y + headerH + srcFieldIdx * rowH + 14;
                    const tgtY = tgtPos.y + headerH + tgtFieldIdx * rowH + 14;

                    let srcX, tgtX;

                    if (srcPos.x + cardW <= tgtPos.x) {
                      srcX = srcPos.x + cardW;
                      tgtX = tgtPos.x;
                    } else if (srcPos.x >= tgtPos.x + cardW) {
                      srcX = srcPos.x;
                      tgtX = tgtPos.x + cardW;
                    } else {
                      srcX = srcPos.x + cardW;
                      tgtX = tgtPos.x + cardW;
                    }

                    const dx = Math.max(50, Math.abs(tgtX - srcX) * 0.45);
                    const pathData = `M ${srcX} ${srcY} C ${
                      srcX <= tgtX ? srcX + dx : srcX - dx
                    } ${srcY}, ${srcX <= tgtX ? tgtX - dx : tgtX + dx} ${tgtY}, ${tgtX} ${tgtY}`;

                    const midX = (srcX + tgtX) / 2;
                    const midY = (srcY + tgtY) / 2;

                    return (
                      <g key={conn.id}>
                        {/* Smooth Cubic Bezier Connection */}
                        <path
                          d={pathData}
                          className={styles.connectionCurve}
                          markerEnd="url(#arrowhead)"
                          onClick={() => handleDeleteConnection(conn.id)}
                          title={`${conn.source}.${conn.sourceField} → ${conn.target}.${conn.targetField} (Click to remove)`}
                        />

                        {/* Anchor Endpoint Dots */}
                        <circle
                          cx={srcX}
                          cy={srcY}
                          r="3.5"
                          className={styles.connectionEndpointDot}
                        />
                        <circle
                          cx={tgtX}
                          cy={tgtY}
                          r="3.5"
                          className={styles.connectionEndpointDot}
                        />

                        {/* Cardinality Badge on Midpoint */}
                        <g
                          className={styles.cardinalityBadgeGroup}
                          onClick={() => handleDeleteConnection(conn.id)}
                        >
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
                      </g>
                    );
                  })}
                </svg>

                {/* Entity Cards */}
                {currentSchema.entities.map((entity) => {
                  const pos = entityPositions[entity.name] || { x: 50, y: 50 };

                  return (
                    <div
                      key={entity.name}
                      className={styles.entityCard}
                      style={{
                        left: `${pos.x}px`,
                        top: `${pos.y}px`,
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
                        {(entity.fields || []).map((field) => {
                          const isConnectingThisField =
                            connectingField?.entityName === entity.name &&
                            connectingField?.fieldName === field.name;

                          return (
                            <div
                              key={field.name}
                              className={`${styles.fieldRow} ${
                                isConnectingThisField ? styles.isFieldConnecting : ''
                              }`}
                            >
                              {/* Left Anchor Port */}
                              <button
                                type="button"
                                className={`${styles.portHandle} ${styles.portLeft}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePortClick(entity.name, field.name);
                                }}
                                title={`Connect from ${entity.name}.${field.name}`}
                                aria-label={`Port for ${entity.name}.${field.name}`}
                              />

                              <div className={styles.fieldLeft}>
                                {(field.isPrimary || field.isForeignKey) && (
                                  <Key
                                    size={10}
                                    style={{
                                      color: field.isPrimary ? '#f59e0b' : '#06b6d4',
                                    }}
                                  />
                                )}
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

                              {/* Right Anchor Port */}
                              <button
                                type="button"
                                className={`${styles.portHandle} ${styles.portRight}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePortClick(entity.name, field.name);
                                }}
                                title={`Connect from ${entity.name}.${field.name}`}
                                aria-label={`Port for ${entity.name}.${field.name}`}
                              />
                            </div>
                          );
                        })}
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

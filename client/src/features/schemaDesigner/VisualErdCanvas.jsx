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
  Plus,
  Trash2,
  Edit2,
  Hand,
  MousePointer,
  CheckSquare,
  Focus,
} from 'lucide-react';
import { useSchemaStore } from '@/store/schemaStore';
import { MermaidBlock } from '@/features/chat/MermaidBlock';
import { toast } from '@/components/ui/Toast';
import styles from './VisualErdCanvas.module.scss';

const FIELD_TYPES = [
  'VARCHAR(255)',
  'UUID',
  'INTEGER',
  'BOOLEAN',
  'TIMESTAMP',
  'TEXT',
  'JSON',
  'DECIMAL',
];

export function VisualErdCanvas() {
  const {
    currentSchema,
    manualLinks,
    isLoading,
    entityPositions,
    setEntityPositions,
    addEntity,
    deleteEntity,
    renameEntity,
    addField,
    updateField,
    deleteField,
    addConnection,
    deleteConnection,
    toggleCardinality,
  } = useSchemaStore();

  const [renderMode, setRenderMode] = useState('interactive'); // 'interactive' | 'mermaid'
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [canvasTool, setCanvasTool] = useState('pointer'); // 'pointer' | 'hand'
  const [isPanning, setIsPanning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Field Connection Mode State
  const [connectingField, setConnectingField] = useState(null); // { entityName, fieldName }

  // Modal / Inline Add & Edit States
  const [isAddEntityModalOpen, setIsAddEntityModalOpen] = useState(false);
  const [newEntityNameInput, setNewEntityNameInput] = useState('');
  const [editingEntityName, setEditingEntityName] = useState(null);
  const [tempEntityName, setTempEntityName] = useState('');

  // Inline Add Field state per entity card
  const [addingFieldEntity, setAddingFieldEntity] = useState(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('VARCHAR(255)');
  const [newFieldPk, setNewFieldPk] = useState(false);

  // Field Edit Popover State
  const [editingFieldModal, setEditingFieldModal] = useState(null); // { entityName, fieldIndex, field }
  const [editFieldNameInput, setEditFieldNameInput] = useState('');
  const [editFieldTypeInput, setEditFieldTypeInput] = useState('VARCHAR(255)');
  const [editFieldPkInput, setEditFieldPkInput] = useState(false);
  const [editFieldReqInput, setEditFieldReqInput] = useState(false);

  // Selected Connection State
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);

  const canvasRef = useRef(null);
  const draggingRef = useRef(null);
  const panDragRef = useRef(null);

  // Compute balanced initial positions for entities if not set
  useEffect(() => {
    if (!currentSchema?.entities?.length) return;
    const newPositions = { ...entityPositions };
    let hasNew = false;

    const cols = Math.min(3, Math.ceil(Math.sqrt(currentSchema.entities.length)));
    const colWidth = 340;
    const rowHeight = 300;

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

    // Merge manual connections
    manualLinks.forEach((ml) => {
      if (
        !list.some(
          (l) =>
            l.source === ml.source &&
            l.sourceField === ml.sourceField &&
            l.target === ml.target &&
            l.targetField === ml.targetField
        )
      ) {
        list.push(ml);
      }
    });

    return list;
  }, [currentSchema, manualLinks]);

  // Handle entity card dragging
  const handleCardMouseDown = useCallback(
    (e, entityName) => {
      if (e.button !== 0 || canvasTool === 'hand') return;
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
            x: Math.round(draggingRef.current.origX + dx),
            y: Math.round(draggingRef.current.origY + dy),
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
    [entityPositions, setEntityPositions, zoom, canvasTool]
  );

  // Handle Infinite Canvas Background Panning
  const handleCanvasMouseDown = (e) => {
    // Only drag pan if clicking canvas background (not card, input, or button)
    if (e.button !== 0 && e.button !== 1) return;
    if (
      e.target.closest(`.${styles.entityCard}`) ||
      e.target.closest('button') ||
      e.target.closest('input') ||
      e.target.closest('select')
    ) {
      return;
    }

    panDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origPanX: pan.x,
      origPanY: pan.y,
    };
    setIsPanning(true);

    const handlePanMouseMove = (moveEvent) => {
      if (!panDragRef.current) return;
      const dx = moveEvent.clientX - panDragRef.current.startX;
      const dy = moveEvent.clientY - panDragRef.current.startY;

      setPan({
        x: Math.round(panDragRef.current.origPanX + dx),
        y: Math.round(panDragRef.current.origPanY + dy),
      });
    };

    const handlePanMouseUp = () => {
      panDragRef.current = null;
      setIsPanning(false);
      window.removeEventListener('mousemove', handlePanMouseMove);
      window.removeEventListener('mouseup', handlePanMouseUp);
    };

    window.addEventListener('mousemove', handlePanMouseMove);
    window.addEventListener('mouseup', handlePanMouseUp);
  };

  // Mouse wheel pan & zoom
  const handleWheel = (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.min(2.5, Math.max(0.3, +(z + zoomDelta).toFixed(2))));
    } else {
      setPan((p) => ({
        x: Math.round(p.x - e.deltaX),
        y: Math.round(p.y - e.deltaY),
      }));
    }
  };

  // Fit View: Centers all entity cards in the viewport
  const handleFitView = () => {
    if (!currentSchema?.entities?.length || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const positions = Object.values(entityPositions);
    if (!positions.length) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    positions.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x + 280 > maxX) maxX = p.x + 280;
      if (p.y + 240 > maxY) maxY = p.y + 240;
    });

    const contentW = maxX - minX + 80;
    const contentH = maxY - minY + 80;

    const scaleX = rect.width / contentW;
    const scaleY = rect.height / contentH;
    const newZoom = Math.min(1.2, Math.max(0.4, +(Math.min(scaleX, scaleY) * 0.85).toFixed(2)));

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    setZoom(newZoom);
    setPan({
      x: Math.round(rect.width / 2 - midX * newZoom),
      y: Math.round(rect.height / 2 - midY * newZoom),
    });
    toast.info('Canvas centered');
  };

  // Reset to default (0, 0, 100%)
  const handleResetLayout = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    toast.success('Reset canvas view');
  };

  // Field port connection handler
  const handlePortClick = (entityName, fieldName) => {
    if (!connectingField) {
      setConnectingField({ entityName, fieldName });
      toast.info(`Port selected: ${entityName}.${fieldName}. Click target field to connect.`);
    } else if (connectingField.entityName === entityName && connectingField.fieldName === fieldName) {
      setConnectingField(null);
    } else {
      // Connect source to target field-to-field
      const newLink = {
        id: `link-${connectingField.entityName}.${connectingField.fieldName}->${entityName}.${fieldName}`,
        source: connectingField.entityName,
        sourceField: connectingField.fieldName,
        target: entityName,
        targetField: fieldName,
        cardinality: '1 : N',
      };

      addConnection(newLink);
      setConnectingField(null);
    }
  };

  // Add Entity Modal Handler
  const handleOpenAddEntity = () => {
    const defaultName = `Entity_${(currentSchema?.entities?.length || 0) + 1}`;
    setNewEntityNameInput(defaultName);
    setIsAddEntityModalOpen(true);
  };

  const handleConfirmAddEntity = () => {
    if (!newEntityNameInput.trim()) return;

    // Calculate smart placement at center of visible canvas
    let centerPos = { x: 80, y: 80 };
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      centerPos = {
        x: Math.round((rect.width / 2 - pan.x) / zoom - 140),
        y: Math.round((rect.height / 2 - pan.y) / zoom - 100),
      };
    }

    addEntity(newEntityNameInput.trim(), centerPos);
    setIsAddEntityModalOpen(false);
    setNewEntityNameInput('');
  };

  // Entity renaming inline
  const startRenameEntity = (entityName) => {
    setEditingEntityName(entityName);
    setTempEntityName(entityName);
  };

  const submitRenameEntity = (oldName) => {
    if (tempEntityName && tempEntityName.trim()) {
      renameEntity(oldName, tempEntityName.trim());
    }
    setEditingEntityName(null);
  };

  // Inline Add Field inside Card Footer
  const handleStartAddField = (entityName) => {
    setAddingFieldEntity(entityName);
    setNewFieldName('');
    setNewFieldType('VARCHAR(255)');
    setNewFieldPk(false);
  };

  const handleSaveNewField = (entityName) => {
    if (!newFieldName.trim()) {
      setAddingFieldEntity(null);
      return;
    }
    addField(entityName, {
      name: newFieldName.trim(),
      type: newFieldType,
      isPrimary: newFieldPk,
      isRequired: newFieldPk,
      isUnique: newFieldPk,
    });
    setAddingFieldEntity(null);
    setNewFieldName('');
  };

  // Field Edit Popover
  const handleOpenEditField = (entityName, fieldIndex, field) => {
    setEditingFieldModal({ entityName, fieldIndex, field });
    setEditFieldNameInput(field.name);
    setEditFieldTypeInput(field.type || 'VARCHAR(255)');
    setEditFieldPkInput(!!field.isPrimary);
    setEditFieldReqInput(!!field.isRequired);
  };

  const handleSaveEditField = () => {
    if (!editingFieldModal || !editFieldNameInput.trim()) return;
    updateField(editingFieldModal.entityName, editingFieldModal.fieldIndex, {
      name: editFieldNameInput.trim(),
      type: editFieldTypeInput,
      isPrimary: editFieldPkInput,
      isRequired: editFieldReqInput || editFieldPkInput,
      isUnique: editFieldPkInput,
    });
    setEditingFieldModal(null);
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

  return (
    <div className={styles.canvasContainer}>
      {/* Top Header Bar */}
      <div className={styles.topBar}>
        <div className={styles.titleArea}>
          <Network size={15} className="text-accent" />
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

        <div className={styles.controls}>
          {/* Add Entity Quick Action */}
          <button
            type="button"
            className={`${styles.btnAction} ${styles.btnAddEntity}`}
            onClick={handleOpenAddEntity}
            title="Create new model/table on canvas"
          >
            <Plus size={13} />
            <span>Add Entity</span>
          </button>

          {currentSchema && (
            <>
              {/* Tool Mode: Pointer vs Pan Hand */}
              <div className={styles.modeToggle}>
                <button
                  type="button"
                  className={`${styles.btnAction} ${canvasTool === 'pointer' ? styles.active : ''}`}
                  onClick={() => setCanvasTool('pointer')}
                  title="Pointer tool: select & move entities"
                >
                  <MousePointer size={12} />
                </button>
                <button
                  type="button"
                  className={`${styles.btnAction} ${canvasTool === 'hand' ? styles.active : ''}`}
                  onClick={() => setCanvasTool('hand')}
                  title="Hand tool: pan infinite canvas"
                >
                  <Hand size={12} />
                </button>
              </div>

              {/* View Mode: Interactive vs Mermaid */}
              <div className={styles.modeToggle}>
                <button
                  type="button"
                  className={`${styles.btnAction} ${renderMode === 'interactive' ? styles.active : ''}`}
                  onClick={() => setRenderMode('interactive')}
                  title="Interactive canvas view"
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
                  <span>Mermaid</span>
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
            </>
          )}
        </div>
      </div>

      {/* Viewport Area */}
      <div
        className={`${styles.viewportContainer} ${canvasTool === 'hand' ? styles.isHandTool : ''} ${
          isPanning ? styles.isPanning : ''
        }`}
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
      >
        {/* Floating guidance banner during connection mode */}
        {connectingField && (
          <div className={styles.connectionHelpHint}>
            <Link2 size={14} className="text-accent" />
            <span>
              Connecting from <strong>{connectingField.entityName}.{connectingField.fieldName}</strong> &rarr; Click any target field to link
            </span>
            <button
              type="button"
              className={styles.cancelLinkBtn}
              onClick={() => setConnectingField(null)}
              title="Cancel connection"
            >
              <X size={13} />
              <span>Cancel</span>
            </button>
          </div>
        )}

        {/* Selected Connection Floating Bar */}
        {selectedConnectionId && (
          <div className={styles.selectedConnBar}>
            <Link2 size={13} className="text-accent" />
            <span>Selected Connection</span>
            <button
              type="button"
              className={styles.connBarAction}
              onClick={() => toggleCardinality(selectedConnectionId)}
              title="Toggle cardinality (1:N, 1:1, N:M)"
            >
              Toggle Type
            </button>
            <button
              type="button"
              className={`${styles.connBarAction} ${styles.btnDanger}`}
              onClick={() => {
                deleteConnection(selectedConnectionId);
                setSelectedConnectionId(null);
              }}
              title="Remove relationship"
            >
              <Trash2 size={12} />
              Delete
            </button>
            <button
              type="button"
              className={styles.connBarClose}
              onClick={() => setSelectedConnectionId(null)}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {currentSchema?.entities?.length ? (
          renderMode === 'interactive' ? (
            <>
              {/* Floating Canvas Controls (Zoom, Fit, Reset) */}
              <div className={styles.floatingCanvasToolbar}>
                <button
                  type="button"
                  className={styles.canvasToolBtn}
                  onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))}
                  title="Zoom In (or Ctrl+Scroll)"
                >
                  <ZoomIn size={14} />
                </button>
                <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  className={styles.canvasToolBtn}
                  onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.15).toFixed(2)))}
                  title="Zoom Out (or Ctrl+Scroll)"
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  type="button"
                  className={styles.canvasToolBtn}
                  onClick={handleFitView}
                  title="Fit & Center All Entities"
                >
                  <Focus size={13} />
                </button>
                <button
                  type="button"
                  className={styles.canvasToolBtn}
                  onClick={handleResetLayout}
                  title="Reset View (100% Pan/Zoom)"
                >
                  <RotateCcw size={13} />
                </button>
              </div>

              {/* Transform Stage: Supports Infinite Panning & Zooming */}
              <div
                className={styles.interactiveCanvas}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                }}
              >
                {/* SVG Connections Overlay with Field-to-Field Smooth Curves */}
                <svg className={styles.svgConnectionsLayer} width="6000" height="6000">
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

                  {connections.map((conn, connIdx) => {
                    const srcEntity = currentSchema.entities.find((e) => e.name === conn.source);
                    const tgtEntity = currentSchema.entities.find((e) => e.name === conn.target);

                    if (!srcEntity || !tgtEntity) return null;

                    const srcPos = entityPositions[conn.source] || { x: 50, y: 50 };
                    const tgtPos = entityPositions[conn.target] || { x: 400, y: 50 };

                    let srcFieldIdx = srcEntity.fields.findIndex(
                      (f) => f.name === conn.sourceField
                    );
                    if (srcFieldIdx === -1) srcFieldIdx = 0;

                    let tgtFieldIdx = tgtEntity.fields.findIndex(
                      (f) => f.name === conn.targetField
                    );
                    if (tgtFieldIdx === -1) {
                      tgtFieldIdx = tgtEntity.fields.findIndex((f) => f.isPrimary);
                      if (tgtFieldIdx === -1) tgtFieldIdx = 0;
                    }

                    const cardW = 280;
                    const headerH = 40;
                    const rowH = 32;

                    // Exact vertical center of field row
                    const srcY = srcPos.y + headerH + srcFieldIdx * rowH + 16;
                    const tgtY = tgtPos.y + headerH + tgtFieldIdx * rowH + 16;

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

                    // Stagger badge position along the curve (38% to 62%) so multiple links never collide
                    const t = 0.38 + ((connIdx % 3) * 0.12);
                    const badgeX = (1 - t) * srcX + t * tgtX;
                    const badgeY = (1 - t) * srcY + t * tgtY;

                    const isSelected = selectedConnectionId === conn.id;

                    return (
                      <g key={conn.id} className={styles.connectionGroup}>
                        {/* Hidden thick path for easy click/hover targeting */}
                        <path
                          d={pathData}
                          className={styles.connectionHoverTarget}
                          onClick={() => setSelectedConnectionId(conn.id)}
                        />

                        {/* Smooth Bezier Connection Line */}
                        <path
                          d={pathData}
                          className={`${styles.connectionCurve} ${isSelected ? styles.isSelectedCurve : ''}`}
                          markerEnd="url(#arrowhead)"
                          onClick={() => setSelectedConnectionId(conn.id)}
                        />

                        {/* Anchor Endpoint Dots */}
                        <circle
                          cx={srcX}
                          cy={srcY}
                          r="3"
                          className={styles.connectionEndpointDot}
                        />
                        <circle
                          cx={tgtX}
                          cy={tgtY}
                          r="3"
                          className={styles.connectionEndpointDot}
                        />

                        {/* Minimalist Cardinality Pill */}
                        <g
                          className={styles.cardinalityBadgeGroup}
                          transform={`translate(${badgeX}, ${badgeY})`}
                          onClick={() => toggleCardinality(conn.id)}
                          title="Click to toggle (1:N, 1:1, N:M)"
                        >
                          <rect
                            x={-18}
                            y={-9}
                            width={36}
                            height={18}
                            rx={4}
                            className={styles.cardinalityBadge}
                          />
                          <text x={0} y={3} className={styles.cardinalityText}>
                            {conn.cardinality || '1 : N'}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </svg>

                {/* Entity Cards */}
                {currentSchema.entities.map((entity) => {
                  const pos = entityPositions[entity.name] || { x: 50, y: 50 };
                  const isRenaming = editingEntityName === entity.name;
                  const isAddingField = addingFieldEntity === entity.name;

                  return (
                    <div
                      key={entity.name}
                      className={styles.entityCard}
                      style={{
                        left: `${pos.x}px`,
                        top: `${pos.y}px`,
                      }}
                    >
                      {/* Entity Header */}
                      <div
                        className={styles.entityCardHeader}
                        onMouseDown={(e) => handleCardMouseDown(e, entity.name)}
                      >
                        <div className={styles.entityNameArea}>
                          <Table size={13} className="text-accent" />
                          {isRenaming ? (
                            <input
                              type="text"
                              className={styles.headerRenameInput}
                              value={tempEntityName}
                              onChange={(e) => setTempEntityName(e.target.value)}
                              onBlur={() => submitRenameEntity(entity.name)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') submitRenameEntity(entity.name);
                                if (e.key === 'Escape') setEditingEntityName(null);
                              }}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span
                              className={styles.entityNameText}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                startRenameEntity(entity.name);
                              }}
                              title="Double-click to rename entity"
                            >
                              {entity.name}
                            </span>
                          )}
                        </div>

                        <div className={styles.headerActions} onMouseDown={(e) => e.stopPropagation()}>
                          <span className={styles.colCountBadge}>
                            {entity.fields?.length || 0}
                          </span>
                          <button
                            type="button"
                            className={styles.headerActionBtn}
                            onClick={() => startRenameEntity(entity.name)}
                            title="Rename Entity"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            type="button"
                            className={`${styles.headerActionBtn} ${styles.btnDanger}`}
                            onClick={() => deleteEntity(entity.name)}
                            title="Delete Entity"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Clean Field List */}
                      <div className={styles.fieldList}>
                        {(entity.fields || []).map((field, idx) => {
                          const isConnectingThisField =
                            connectingField?.entityName === entity.name &&
                            connectingField?.fieldName === field.name;

                          return (
                            <div
                              key={field.name || idx}
                              className={`${styles.fieldRow} ${
                                isConnectingThisField ? styles.isFieldConnecting : ''
                              } ${connectingField && !isConnectingThisField ? styles.isTargetCandidate : ''}`}
                              onClick={() => {
                                if (connectingField && !isConnectingThisField) {
                                  handlePortClick(entity.name, field.name);
                                }
                              }}
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
                              />

                              {/* Field Name & Badges */}
                              <div className={styles.fieldLeft}>
                                {field.isPrimary && (
                                  <Key size={10} className={styles.keyIcon} title="Primary Key" />
                                )}
                                <span
                                  className={styles.fieldName}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditField(entity.name, idx, field);
                                  }}
                                  title="Double-click to edit field"
                                >
                                  {field.name}
                                </span>
                              </div>

                              {/* Clean Type & Minimal Badges */}
                              <div className={styles.fieldRight} onClick={(e) => e.stopPropagation()}>
                                <span
                                  className={styles.cleanTypeTag}
                                  onClick={() => handleOpenEditField(entity.name, idx, field)}
                                  title="Click to edit field settings"
                                >
                                  {(field.type || 'varchar').toLowerCase()}
                                </span>

                                {field.isPrimary && <span className={styles.tagPk}>PK</span>}
                                {field.isForeignKey && <span className={styles.tagFk}>FK</span>}

                                {/* Row Hover Actions */}
                                <div className={styles.rowActions}>
                                  <button
                                    type="button"
                                    className={styles.rowActionBtn}
                                    onClick={() => handleOpenEditField(entity.name, idx, field)}
                                    title="Edit Field"
                                  >
                                    <Edit2 size={10} />
                                  </button>
                                  <button
                                    type="button"
                                    className={`${styles.rowActionBtn} ${styles.btnDanger}`}
                                    onClick={() => deleteField(entity.name, idx)}
                                    title="Delete Field"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
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
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Inline Add Field Row */}
                      {isAddingField ? (
                        <div className={styles.inlineAddFieldRow} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            className={styles.inlineInput}
                            placeholder="Field name (e.g. email, price)..."
                            value={newFieldName}
                            onChange={(e) => setNewFieldName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveNewField(entity.name);
                              if (e.key === 'Escape') setAddingFieldEntity(null);
                            }}
                            autoFocus
                          />
                          <select
                            className={styles.inlineSelect}
                            value={newFieldType}
                            onChange={(e) => setNewFieldType(e.target.value)}
                          >
                            {FIELD_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t.toLowerCase()}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className={`${styles.inlinePkBtn} ${newFieldPk ? styles.active : ''}`}
                            onClick={() => setNewFieldPk(!newFieldPk)}
                            title="Primary Key"
                          >
                            PK
                          </button>
                          <button
                            type="button"
                            className={styles.inlineSaveBtn}
                            onClick={() => handleSaveNewField(entity.name)}
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            className={styles.inlineCancelBtn}
                            onClick={() => setAddingFieldEntity(null)}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className={styles.cardFooter}>
                          <button
                            type="button"
                            className={styles.btnAddField}
                            onClick={() => handleStartAddField(entity.name)}
                          >
                            <Plus size={11} />
                            <span>Add Field</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ height: '100%', overflow: 'auto', padding: '16px' }}>
              <MermaidBlock chart={currentSchema.mermaidErDiagram} isStreaming={isLoading} />
            </div>
          )
        ) : (
          <div className={styles.emptyArea}>
            <Network size={44} className={styles.emptyIcon} />
            <h4>No Active Data Model</h4>
            <p>
              Click <strong>Add Entity</strong> above or use the AI prompt bar below to design your domain architecture.
            </p>
            <button
              type="button"
              className={styles.btnEmptyCreate}
              onClick={handleOpenAddEntity}
            >
              <Plus size={14} />
              <span>Create First Entity</span>
            </button>
          </div>
        )}
      </div>

      {/* Add Entity Modal */}
      {isAddEntityModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setIsAddEntityModalOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className="flex items-center gap-2">
                <Table size={15} className="text-accent" />
                <h5>Create New Entity</h5>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setIsAddEntityModalOpen(false)}
              >
                <X size={14} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.modalLabel}>Entity Name</label>
              <input
                type="text"
                className={styles.modalInput}
                placeholder="e.g. Customer, OrderItem, Invoice..."
                value={newEntityNameInput}
                onChange={(e) => setNewEntityNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmAddEntity();
                  if (e.key === 'Escape') setIsAddEntityModalOpen(false);
                }}
                autoFocus
              />
              <p className={styles.modalHelp}>
                Will be placed in the center of your visible canvas with default ID & timestamp columns.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setIsAddEntityModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalSubmitBtn}
                onClick={handleConfirmAddEntity}
                disabled={!newEntityNameInput.trim()}
              >
                Add Entity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Field Edit Popover Modal */}
      {editingFieldModal && (
        <div className={styles.modalBackdrop} onClick={() => setEditingFieldModal(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className="flex items-center gap-2">
                <Edit2 size={14} className="text-accent" />
                <h5>Edit Column: {editingFieldModal.entityName}.{editingFieldModal.field.name}</h5>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setEditingFieldModal(null)}
              >
                <X size={14} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <label className={styles.modalLabel}>Column Name</label>
                <input
                  type="text"
                  className={styles.modalInput}
                  value={editFieldNameInput}
                  onChange={(e) => setEditFieldNameInput(e.target.value)}
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.modalLabel}>Data Type</label>
                <select
                  className={styles.modalSelect}
                  value={editFieldTypeInput}
                  onChange={(e) => setEditFieldTypeInput(e.target.value)}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.checkboxGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={editFieldPkInput}
                    onChange={(e) => setEditFieldPkInput(e.target.checked)}
                  />
                  <span>Primary Key (PK)</span>
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={editFieldReqInput}
                    onChange={(e) => setEditFieldReqInput(e.target.checked)}
                  />
                  <span>Required (NOT NULL)</span>
                </label>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={`${styles.modalCancelBtn} ${styles.btnDanger}`}
                onClick={() => {
                  deleteField(editingFieldModal.entityName, editingFieldModal.fieldIndex);
                  setEditingFieldModal(null);
                }}
              >
                Delete Column
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={styles.modalCancelBtn}
                  onClick={() => setEditingFieldModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.modalSubmitBtn}
                  onClick={handleSaveEditField}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

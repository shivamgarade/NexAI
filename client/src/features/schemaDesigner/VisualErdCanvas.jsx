import { useState, useRef, useMemo, useCallback } from 'react';
import {
  Table2,
  Plus,
  Trash2,
  Edit2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Focus,
  MousePointer,
  Hand,
  Link2,
  X,
  Key,
  Check,
  Sparkles,
} from 'lucide-react';
import { useSchemaStore } from '@/store/schemaStore';
import { Button } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import styles from './VisualErdCanvas.module.scss';

const RELATION_TYPES = [
  { id: 'many-to-one', label: 'Many to One ( > )' },
  { id: 'one-to-many', label: 'One to Many ( < )' },
  { id: 'one-to-one', label: 'One to One ( - )' },
  { id: 'many-to-many', label: 'Many to Many ( <> )' },
];

export function VisualErdCanvas() {
  const {
    model,
    selectedEntityId,
    setSelectedEntityId,
    selectedRelationId,
    setSelectedRelationId,
    addEntity,
    deleteEntity,
    renameEntity,
    addField,
    updateField,
    deleteField,
    addRelation,
    updateRelationType,
    deleteRelation,
    updateLayout,
    aiPreview,
    confirmAiPreview,
    discardAiPreview,
    isLoading,
  } = useSchemaStore();

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [canvasTool, setCanvasTool] = useState('pointer'); // 'pointer' | 'hand'
  const [isPanning, setIsPanning] = useState(false);

  // Field Connection Mode State
  const [connectingField, setConnectingField] = useState(null); // { entityId, fieldId, entityName, fieldName }

  // Inline rename entity state
  const [editingEntityId, setEditingEntityId] = useState(null);
  const [tempEntityName, setTempEntityName] = useState('');

  const canvasRef = useRef(null);
  const draggingRef = useRef(null);
  const panDragRef = useRef(null);

  // Display entities: preview entities if aiPreview exists, otherwise model.entities
  const entities = useMemo(() => {
    return aiPreview ? aiPreview.model.entities : model.entities || [];
  }, [aiPreview, model.entities]);

  // Display relations: preview relations if aiPreview exists, otherwise model.relations
  const relations = useMemo(() => {
    return aiPreview ? aiPreview.model.relations : model.relations || [];
  }, [aiPreview, model.relations]);

  const layout = useMemo(() => {
    return aiPreview ? { ...model.layout, ...aiPreview.model.layout } : model.layout || {};
  }, [aiPreview, model.layout]);

  // Handle Dragging an Entity Card
  const handleCardMouseDown = useCallback(
    (e, entityId) => {
      if (canvasTool === 'hand' || e.button !== 0) return;
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const currentPos = layout[entityId] || { x: 50, y: 50 };

      draggingRef.current = {
        entityId,
        startX,
        startY,
        origX: currentPos.x,
        origY: currentPos.y,
      };

      const handleMouseMove = (moveEvent) => {
        if (!draggingRef.current) return;
        const dx = (moveEvent.clientX - draggingRef.current.startX) / zoom;
        const dy = (moveEvent.clientY - draggingRef.current.startY) / zoom;

        updateLayout({
          [draggingRef.current.entityId]: {
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
    [layout, updateLayout, zoom, canvasTool]
  );

  // Handle Infinite Canvas Background Panning
  const handleCanvasMouseDown = (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (
      e.target.closest(`.${styles.entityCard}`) ||
      e.target.closest('button') ||
      e.target.closest('input')
    ) {
      return;
    }

    // Deselect on empty canvas click
    setSelectedEntityId(null);
    setSelectedRelationId(null);

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

  // Zoom on wheel
  const handleWheel = (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((prev) => Math.min(2.5, Math.max(0.3, +(prev * zoomFactor).toFixed(2))));
  };

  const handleZoomIn = () => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.3, +(z - 0.15).toFixed(2)));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitView = () => {
    if (!entities.length || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const positions = Object.values(layout);
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
    let newZoom = Math.min(1.2, Math.max(0.4, +(Math.min(scaleX, scaleY) * 0.85).toFixed(2)));

    // Snap to 100% (1.0) if close to 1.0
    if (newZoom >= 0.92 && newZoom <= 1.08) {
      newZoom = 1;
    }

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    setZoom(newZoom);
    setPan({
      x: Math.round(rect.width / 2 - midX * newZoom),
      y: Math.round(rect.height / 2 - midY * newZoom),
    });
    toast.info('Canvas centered');
  };

  // Handle port connection click
  const handlePortClick = (entity, field, e) => {
    e.stopPropagation();

    if (!connectingField) {
      setConnectingField({
        entityId: entity.id,
        fieldId: field.id,
        entityName: entity.name,
        fieldName: field.name,
      });
      toast.info(`Connecting from ${entity.name}.${field.name} → Click target field`);
    } else if (connectingField.entityId === entity.id && connectingField.fieldId === field.id) {
      setConnectingField(null);
    } else {
      // Connect
      addRelation(
        connectingField.entityId,
        connectingField.fieldId,
        entity.id,
        field.id,
        'many-to-one'
      );
      setConnectingField(null);
    }
  };

  const startRename = (entity) => {
    setEditingEntityId(entity.id);
    setTempEntityName(entity.name);
  };

  const submitRename = (entityId) => {
    if (tempEntityName && tempEntityName.trim()) {
      renameEntity(entityId, tempEntityName.trim());
    }
    setEditingEntityId(null);
  };

  return (
    <div className={styles.canvasWrapper}>
      {/* Suggest -> Review -> Confirm Banner */}
      {aiPreview && (
        <div className={styles.previewBanner}>
          <div className={styles.previewBadge}>
            <Sparkles size={13} className={styles.sparkleIcon} />
            <span>AI Proposal</span>
          </div>

          <div className={styles.previewSummary} title={aiPreview.summary}>
            {aiPreview.summary}
          </div>

          <div className={styles.previewActions}>
            <button
              type="button"
              className={styles.discardBtn}
              onClick={discardAiPreview}
              title="Discard AI changes"
            >
              <X size={13} />
              <span>Discard</span>
            </button>
            <button
              type="button"
              className={styles.acceptBtn}
              onClick={confirmAiPreview}
              title="Accept AI proposed diagram"
            >
              <Check size={13} />
              <span>Accept Changes</span>
            </button>
          </div>
        </div>
      )}

      {/* AI Generating Loading Overlay */}
      {isLoading && (
        <div className={styles.loadingBanner}>
          <div className={styles.loadingSpinner} />
          <span>Generating database architecture…</span>
        </div>
      )}

      {/* Connection Help Banner */}
      {connectingField && (
        <div className={styles.connectingBanner}>
          <Link2 size={14} />
          <span>
            Connecting from <strong>{connectingField.entityName}.{connectingField.fieldName}</strong> &rarr; Click target field to connect
          </span>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => setConnectingField(null)}
          >
            <X size={13} />
            <span>Cancel</span>
          </button>
        </div>
      )}

      {/* Main Interactive Stage */}
      <div
        className={`${styles.viewport} ${canvasTool === 'hand' ? styles.isHandTool : ''} ${
          isPanning ? styles.isPanning : ''
        }`}
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
      >
        <div
          className={styles.stage}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* SVG Relations Layer (Orthogonal Right-Angle Connectors) */}
          <svg className={styles.svgLayer} width="8000" height="8000">
            {relations.map((rel) => {
              const fromEnt = entities.find((e) => e.id === rel.from?.entityId);
              const toEnt = entities.find((e) => e.id === rel.to?.entityId);

              if (!fromEnt || !toEnt) return null;

              const fromPos = layout[fromEnt.id] || { x: 50, y: 50 };
              const toPos = layout[toEnt.id] || { x: 400, y: 50 };

              // Find exact field index in each entity
              let fromIdx = (fromEnt.fields || []).findIndex((f) => f.id === rel.from?.fieldId);
              let toIdx = (toEnt.fields || []).findIndex((f) => f.id === rel.to?.fieldId);
              if (fromIdx === -1) fromIdx = 0;
              if (toIdx === -1) toIdx = 0;

              const cardW = 260;
              const headerH = 36;
              const rowH = 28;

              // Exact vertical middle of the respective field row
              const fromY = Math.round(fromPos.y + headerH + fromIdx * rowH + rowH / 2);
              const toY = Math.round(toPos.y + headerH + toIdx * rowH + rowH / 2);

              let fromX, toX;
              if (fromPos.x + cardW <= toPos.x) {
                fromX = fromPos.x + cardW;
                toX = toPos.x;
              } else if (fromPos.x >= toPos.x + cardW) {
                fromX = fromPos.x;
                toX = toPos.x + cardW;
              } else {
                fromX = fromPos.x + cardW;
                toX = toPos.x + cardW;
              }

              // Orthogonal Step-Routing (Right-angle with mid-break)
              const midX = Math.round((fromX + toX) / 2);
              const pathData = `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`;

              const isRelSelected = selectedRelationId === rel.id;
              const isTableRelated =
                selectedEntityId === fromEnt.id || selectedEntityId === toEnt.id;
              const hasSelection = Boolean(selectedEntityId);

              // Source entity accent color
              const relColor = fromEnt.color || 'var(--color-accent, #3b82f6)';

              // Cardinality Labels
              const fromMarker =
                rel.type === 'many-to-one' || rel.type === 'many-to-many' ? 'N' : '1';
              const toMarker =
                rel.type === 'one-to-many' || rel.type === 'many-to-many' ? 'N' : '1';

              return (
                <g
                  key={rel.id}
                  className={`${styles.relationGroup} ${
                    isRelSelected ? styles.relSelected : ''
                  } ${isTableRelated ? styles.relHighlight : ''} ${
                    hasSelection && !isTableRelated ? styles.relDimmed : ''
                  }`}
                  style={{ '--rel-color': relColor }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRelationId(rel.id);
                  }}
                >
                  <path d={pathData} className={styles.relationPathHitbox} />
                  <path d={pathData} className={styles.relationPath} />

                  {/* Endpoint Pins */}
                  <circle cx={fromX} cy={fromY} r="3" className={styles.endpointDot} />
                  <circle cx={toX} cy={toY} r="3" className={styles.endpointDot} />

                  {/* Cardinality Badge Pills drawn directly on line */}
                  <g transform={`translate(${fromX <= toX ? fromX + 12 : fromX - 12}, ${fromY})`}>
                    <rect x="-7" y="-8" width="14" height="15" rx="3" className={styles.markerBg} />
                    <text y="3" textAnchor="middle" className={styles.markerText}>
                      {fromMarker}
                    </text>
                  </g>

                  <g transform={`translate(${toX <= fromX ? toX + 12 : toX - 12}, ${toY})`}>
                    <rect x="-7" y="-8" width="14" height="15" rx="3" className={styles.markerBg} />
                    <text y="3" textAnchor="middle" className={styles.markerText}>
                      {toMarker}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          {/* Entity Cards */}
          {entities.map((entity) => {
            const pos = layout[entity.id] || { x: 50, y: 50 };
            const isSelected = selectedEntityId === entity.id;
            const hasSelection = Boolean(selectedEntityId);
            const isDimmed = hasSelection && !isSelected;
            const isRenaming = editingEntityId === entity.id;

            return (
              <div
                key={entity.id}
                className={`${styles.entityCard} ${isSelected ? styles.cardSelected : ''} ${
                  isDimmed ? styles.cardDimmed : ''
                }`}
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedEntityId(entity.id);
                }}
              >
                {/* Entity Header with 8px Color Square Indicator */}
                <div
                  className={styles.cardHeader}
                  onMouseDown={(e) => handleCardMouseDown(e, entity.id)}
                >
                  <div className={styles.headerTitleArea}>
                    <span
                      className={styles.colorSquare}
                      style={{
                        backgroundColor: entity.color || 'var(--color-accent, #3b82f6)',
                      }}
                      title={`Color: ${entity.color || 'default'}`}
                    />
                    {isRenaming ? (
                      <input
                        type="text"
                        value={tempEntityName}
                        onChange={(e) => setTempEntityName(e.target.value)}
                        onBlur={() => submitRename(entity.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitRename(entity.id);
                          if (e.key === 'Escape') setEditingEntityId(null);
                        }}
                        autoFocus
                        className={styles.headerRenameInput}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className={styles.entityTitle}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          startRename(entity);
                        }}
                        title="Double-click to rename"
                      >
                        {entity.name}
                      </span>
                    )}
                  </div>

                  <div className={styles.headerActions} onMouseDown={(e) => e.stopPropagation()}>
                    <span className={styles.countBadge}>{entity.fields?.length || 0}</span>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => startRename(entity)}
                      title="Rename Table"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.btnDanger}`}
                      onClick={() => deleteEntity(entity.id)}
                      title="Delete Table"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Field Rows List */}
                <div className={styles.fieldRowsList}>
                  {(entity.fields || []).map((field) => {
                    const isFk = relations.some(
                      (r) => r.from.entityId === entity.id && r.from.fieldId === field.id
                    );

                    return (
                      <div key={field.id} className={styles.fieldRow}>
                        <div className={styles.fieldLeft}>
                          {/* Fixed 16px icon column for perfect field name alignment */}
                          <div className={styles.fieldIconCol}>
                            {field.pk ? (
                              <Key size={11} className={styles.pkIcon} title="Primary Key" />
                            ) : isFk ? (
                              <Link2 size={11} className={styles.fkIcon} title="Foreign Key" />
                            ) : null}
                          </div>

                          <span className={styles.fieldName} title={field.name}>
                            {field.name}
                          </span>
                        </div>

                        <div className={styles.fieldRight}>
                          <span className={styles.fieldType}>{field.type}</span>

                          {field.unique && <span className={styles.modBadge}>UQ</span>}
                          {field.nullable && <span className={styles.modBadge}>NULL</span>}

                          {/* Quick delete field button (visible on hover) */}
                          <button
                            type="button"
                            className={styles.deleteFieldBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteField(entity.id, field.id);
                            }}
                            title="Remove field"
                          >
                            <X size={10} />
                          </button>

                          {/* Connection Port Dot */}
                          <button
                            type="button"
                            className={`${styles.portBtn} ${
                              connectingField?.fieldId === field.id ? styles.portActive : ''
                            }`}
                            onClick={(e) => handlePortClick(entity, field, e)}
                            title="Click to connect relation"
                          >
                            <span className={styles.portDot} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Field Row Button */}
                <div className={styles.cardFooter}>
                  <button
                    type="button"
                    className={styles.addFieldBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      addField(entity.id);
                    }}
                  >
                    <Plus size={11} />
                    <span>Add Field</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Relation Menu Popover (When a relation is selected) */}
      {selectedRelationId && (
        <div className={styles.relationPopover}>
          <div className={styles.relPopoverHeader}>
            <span>Relationship Type</span>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setSelectedRelationId(null)}
            >
              <X size={12} />
            </button>
          </div>

          <div className={styles.relTypesList}>
            {RELATION_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={styles.relTypeOption}
                onClick={() => {
                  updateRelationType(selectedRelationId, t.id);
                  setSelectedRelationId(null);
                }}
              >
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <div className={styles.relPopoverFooter}>
            <button
              type="button"
              className={styles.deleteRelBtn}
              onClick={() => deleteRelation(selectedRelationId)}
            >
              <Trash2 size={12} />
              <span>Delete Relationship</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Bottom-Center Toolbar */}
      <div className={styles.floatingToolbar}>
        <button
          type="button"
          className={styles.pillBtn}
          onClick={() => addEntity()}
          title="Add New Table"
        >
          <Plus size={13} />
          <span>Table</span>
        </button>

        <div className={styles.pillDivider} />

        <button
          type="button"
          className={`${styles.pillBtn} ${canvasTool === 'pointer' ? styles.pillActive : ''}`}
          onClick={() => setCanvasTool('pointer')}
          title="Pointer Tool"
        >
          <MousePointer size={13} />
        </button>

        <button
          type="button"
          className={`${styles.pillBtn} ${canvasTool === 'hand' ? styles.pillActive : ''}`}
          onClick={() => setCanvasTool('hand')}
          title="Hand (Pan Canvas)"
        >
          <Hand size={13} />
        </button>

        <div className={styles.pillDivider} />

        <button type="button" className={styles.pillBtn} onClick={handleZoomIn} title="Zoom In">
          <ZoomIn size={13} />
        </button>

        <button type="button" className={styles.pillBtn} onClick={handleZoomOut} title="Zoom Out">
          <ZoomOut size={13} />
        </button>

        <button type="button" className={styles.pillBtn} onClick={handleFitView} title="Fit View">
          <Focus size={13} />
        </button>

        <button
          type="button"
          className={styles.pillBtn}
          onClick={handleResetZoom}
          title="Reset Zoom"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* Bottom-Left Stats */}
      <div className={styles.statsFooter}>
        <span>{entities.length} tables</span>
        <span>·</span>
        <span>{relations.length} relations</span>
        <span>·</span>
        <span>{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
}

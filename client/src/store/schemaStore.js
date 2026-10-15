import { create } from 'zustand';
import {
  parse,
  serialize,
  createEmptyModel,
  generateId,
  exportToSQL,
  exportToPrisma,
} from '@/features/schemaDesigner/erLang';
import { schemaApi } from '@/lib/api/schema.api.js';
import { libraryApi } from '@/lib/api/library.api.js';
import { toast } from '@/components/ui/Toast';

const MAX_HISTORY = 30;

export const useSchemaStore = create((set, get) => ({
  // Core ER Model (Single Source of Truth)
  model: createEmptyModel(),

  // Serialized ER Code
  code: '',

  // Code editor diagnostics
  parseErrors: [],

  // Undo / Redo history stacks
  history: {
    past: [],
    future: [],
  },

  // Selection & UI State
  title: 'Untitled Schema',
  prompt: '',
  selectedEntityId: null,
  selectedRelationId: null,
  viewMode: 'split', // 'split' | 'erd' | 'code'
  selectedModel: 'flash',
  isLoading: false,
  isReviewModalOpen: false,

  // Suggest -> Review -> Confirm preview model
  aiPreview: null, // { model, code, summary } when awaiting confirmation

  // Backward compatibility getters for existing canvas references
  get currentSchema() {
    const { model } = get();
    return {
      title: get().title,
      entities: model.entities || [],
    };
  },

  get entityPositions() {
    return get().model.layout || {};
  },

  setTitle: (title) => set({ title }),
  setPrompt: (prompt) => set({ prompt }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSelectedEntityId: (id) => set({ selectedEntityId: id }),
  setSelectedRelationId: (id) => set({ selectedRelationId: id }),
  setSelectedModel: (selectedModel) => set({ selectedModel }),
  setReviewModalOpen: (isOpen) => set({ isReviewModalOpen: isOpen }),

  // Push current model state to undo history
  _pushHistory: () => {
    const { model, history } = get();
    const snapshot = JSON.parse(JSON.stringify(model));
    const nextPast = [...history.past, snapshot].slice(-MAX_HISTORY);
    set({
      history: {
        past: nextPast,
        future: [],
      },
    });
  },

  // Set code directly (from editor typing) -> parses and updates model if valid
  setCode: (newCode) => {
    const { model: currentModel } = get();
    const { model: parsedModel, errors } = parse(newCode, currentModel);

    set({ code: newCode });

    if (errors.length === 0) {
      // Valid code: sync canvas model and clear errors
      set({
        model: parsedModel,
        parseErrors: [],
      });
    } else {
      // Keep last valid diagram and surface parse errors
      set({ parseErrors: errors });
    }
  },

  // Helper to commit canvas mutations -> updates model, pushes history, serializes to code
  _commitModelChange: (nextModel) => {
    get()._pushHistory();
    const newCode = serialize(nextModel);
    set({
      model: nextModel,
      code: newCode,
      parseErrors: [],
    });
  },

  /* ==========================================================================
     CANVAS CRUD ACTIONS (Write to Model -> Serializes to Code)
     ========================================================================== */

  // Add entity
  addEntity: (name, color, pos) => {
    const { model } = get();
    const entityCount = model.entities.length;
    const entityName = (name || `entity_${entityCount + 1}`)
      .trim()
      .replace(/[^a-zA-Z0-9_]/g, '');

    const entityId = generateId('ent');
    const col = entityCount % 3;
    const row = Math.floor(entityCount / 3);
    const defaultPos = pos || { x: 50 + col * 320, y: 50 + row * 280 };

    const newEntity = {
      id: entityId,
      name: entityName,
      color: color || undefined,
      fields: [
        {
          id: generateId('fld'),
          name: 'id',
          type: 'uuid',
          pk: true,
          unique: true,
          nullable: false,
        },
        {
          id: generateId('fld'),
          name: 'name',
          type: 'string',
          pk: false,
          unique: false,
          nullable: false,
        },
      ],
    };

    const nextModel = {
      ...model,
      entities: [...model.entities, newEntity],
      layout: {
        ...model.layout,
        [entityId]: defaultPos,
      },
    };

    get()._commitModelChange(nextModel);
    set({ selectedEntityId: entityId });
    toast.success(`Added table "${entityName}"`);
  },

  // Rename entity
  renameEntity: (entityId, newName) => {
    const { model } = get();
    const sanitized = (newName || '').trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!sanitized) return;

    const nextEntities = model.entities.map((e) =>
      e.id === entityId || e.name === entityId ? { ...e, name: sanitized } : e
    );

    get()._commitModelChange({ ...model, entities: nextEntities });
  },

  // Update entity color
  updateEntityColor: (entityId, color) => {
    const { model } = get();
    const nextEntities = model.entities.map((e) =>
      e.id === entityId ? { ...e, color: color || undefined } : e
    );
    get()._commitModelChange({ ...model, entities: nextEntities });
  },

  // Delete entity (and cascade delete its relations)
  deleteEntity: (entityId) => {
    const { model } = get();
    const entity = model.entities.find((e) => e.id === entityId || e.name === entityId);
    if (!entity) return;

    const targetId = entity.id;
    const nextEntities = model.entities.filter((e) => e.id !== targetId);
    const nextRelations = (model.relations || []).filter(
      (r) => r.from.entityId !== targetId && r.to.entityId !== targetId
    );
    const nextLayout = { ...model.layout };
    delete nextLayout[targetId];

    get()._commitModelChange({
      entities: nextEntities,
      relations: nextRelations,
      layout: nextLayout,
    });

    if (get().selectedEntityId === targetId) {
      set({ selectedEntityId: null });
    }
    toast.info(`Deleted table "${entity.name}"`);
  },

  // Add field
  addField: (entityId, fieldData) => {
    const { model } = get();
    const entity = model.entities.find((e) => e.id === entityId || e.name === entityId);
    if (!entity) return;

    const newField = {
      id: generateId('fld'),
      name: fieldData?.name || `col_${(entity.fields || []).length + 1}`,
      type: fieldData?.type || 'string',
      pk: Boolean(fieldData?.pk),
      unique: Boolean(fieldData?.unique),
      nullable: Boolean(fieldData?.nullable),
    };

    const nextEntities = model.entities.map((e) =>
      e.id === entity.id ? { ...e, fields: [...(e.fields || []), newField] } : e
    );

    get()._commitModelChange({ ...model, entities: nextEntities });
  },

  // Update field
  updateField: (entityId, fieldId, updatedData) => {
    const { model } = get();
    const entity = model.entities.find((e) => e.id === entityId || e.name === entityId);
    if (!entity) return;

    const nextFields = (entity.fields || []).map((f) =>
      f.id === fieldId || f.name === fieldId ? { ...f, ...updatedData } : f
    );

    const nextEntities = model.entities.map((e) =>
      e.id === entity.id ? { ...e, fields: nextFields } : e
    );

    get()._commitModelChange({ ...model, entities: nextEntities });
  },

  // Delete field (and any relations using this field)
  deleteField: (entityId, fieldId) => {
    const { model } = get();
    const entity = model.entities.find((e) => e.id === entityId || e.name === entityId);
    if (!entity) return;

    const field = (entity.fields || []).find((f) => f.id === fieldId || f.name === fieldId);
    if (!field) return;

    const actualFieldId = field.id;
    const nextFields = (entity.fields || []).filter((f) => f.id !== actualFieldId);

    const nextRelations = (model.relations || []).filter(
      (r) =>
        !(r.from.entityId === entity.id && r.from.fieldId === actualFieldId) &&
        !(r.to.entityId === entity.id && r.to.fieldId === actualFieldId)
    );

    const nextEntities = model.entities.map((e) =>
      e.id === entity.id ? { ...e, fields: nextFields } : e
    );

    get()._commitModelChange({
      ...model,
      entities: nextEntities,
      relations: nextRelations,
    });
  },

  // Reorder fields
  reorderFields: (entityId, startIndex, endIndex) => {
    const { model } = get();
    const entity = model.entities.find((e) => e.id === entityId || e.name === entityId);
    if (!entity) return;

    const nextFields = [...(entity.fields || [])];
    const [moved] = nextFields.splice(startIndex, 1);
    nextFields.splice(endIndex, 0, moved);

    const nextEntities = model.entities.map((e) =>
      e.id === entity.id ? { ...e, fields: nextFields } : e
    );

    get()._commitModelChange({ ...model, entities: nextEntities });
  },

  // Add Relation: from field port to to field port
  addRelation: (fromEntityId, fromFieldId, toEntityId, toFieldId, type = 'many-to-one') => {
    const { model } = get();

    // Check if relation already exists
    const exists = (model.relations || []).some(
      (r) =>
        r.from.entityId === fromEntityId &&
        r.from.fieldId === fromFieldId &&
        r.to.entityId === toEntityId &&
        r.to.fieldId === toFieldId
    );

    if (exists) return;

    const newRelation = {
      id: generateId('rel'),
      from: { entityId: fromEntityId, fieldId: fromFieldId },
      to: { entityId: toEntityId, fieldId: toFieldId },
      type,
    };

    const nextRelations = [...(model.relations || []), newRelation];
    get()._commitModelChange({ ...model, relations: nextRelations });

    // Toast feedback
    const fromEnt = model.entities.find((e) => e.id === fromEntityId);
    const toEnt = model.entities.find((e) => e.id === toEntityId);
    toast.success(`Connected ${fromEnt?.name || 'A'} → ${toEnt?.name || 'B'}`);
  },

  // Update relation type (e.g. toggle between many-to-one, one-to-one, one-to-many, many-to-many)
  updateRelationType: (relationId, newType) => {
    const { model } = get();
    const nextRelations = (model.relations || []).map((r) =>
      r.id === relationId ? { ...r, type: newType } : r
    );
    get()._commitModelChange({ ...model, relations: nextRelations });
  },

  // Delete relation
  deleteRelation: (relationId) => {
    const { model } = get();
    const nextRelations = (model.relations || []).filter((r) => r.id !== relationId);
    get()._commitModelChange({ ...model, relations: nextRelations });
    if (get().selectedRelationId === relationId) {
      set({ selectedRelationId: null });
    }
    toast.info('Relation removed');
  },

  // Update layout positions (does NOT serialize to code)
  updateLayout: (positions) => {
    const { model } = get();
    set({
      model: {
        ...model,
        layout: {
          ...model.layout,
          ...positions,
        },
      },
    });
  },

  // Set entity positions for backward compatibility
  setEntityPositions: (positions) => {
    get().updateLayout(positions);
  },

  // Undo / Redo
  undo: () => {
    const { history, model } = get();
    if (!history.past.length) return;

    const previous = history.past[history.past.length - 1];
    const nextPast = history.past.slice(0, -1);
    const currentSnapshot = JSON.parse(JSON.stringify(model));

    set({
      model: previous,
      code: serialize(previous),
      parseErrors: [],
      history: {
        past: nextPast,
        future: [currentSnapshot, ...history.future],
      },
    });
  },

  redo: () => {
    const { history, model } = get();
    if (!history.future.length) return;

    const next = history.future[0];
    const nextFuture = history.future.slice(1);
    const currentSnapshot = JSON.parse(JSON.stringify(model));

    set({
      model: next,
      code: serialize(next),
      parseErrors: [],
      history: {
        past: [...history.past, currentSnapshot],
        future: nextFuture,
      },
    });
  },

  /* ==========================================================================
     AI GENERATE & REFINE (Suggest -> Review -> Confirm)
     ========================================================================== */

  // Request AI generation / refinement
  generateSchema: async (promptText) => {
    if (!promptText || !promptText.trim()) return;

    set({ isLoading: true });

    try {
      const { code: currentCode, selectedModel } = get();

      const response = await schemaApi.generateSchema({
        prompt: promptText.trim(),
        currentCode,
        model: selectedModel,
      });

      const payload = response?.data || response || {};
      const aiCode = payload.code || payload.schema?.code || '';
      const summary = payload.summary || 'Generated ER model update';

      // Parse the returned AI code
      const { model: previewModel, errors } = parse(aiCode);

      if (errors.length === 0 && previewModel.entities.length > 0) {
        // Set AI Preview for Suggest -> Review -> Confirm
        set({
          aiPreview: {
            model: previewModel,
            code: aiCode,
            summary,
          },
          isLoading: false,
        });
      } else {
        // Fallback: apply directly if parse succeeds
        get().setCode(aiCode);
        set({ isLoading: false });
      }

      toast.success('AI generated ER diagram preview!');
    } catch (err) {
      const errorMsg =
        err.response?.data?.error?.message ||
        err.message ||
        'Failed to generate ER diagram';
      set({ isLoading: false });
      toast.error(errorMsg);
    }
  },

  // Confirm AI Suggestion
  confirmAiPreview: () => {
    const { aiPreview } = get();
    if (!aiPreview) return;

    get()._commitModelChange(aiPreview.model);
    set({ aiPreview: null });
    toast.success('Accepted AI diagram changes!');
  },

  // Discard AI Suggestion
  discardAiPreview: () => {
    set({ aiPreview: null });
    toast.info('Discarded AI preview');
  },

  /* ==========================================================================
     EXPORTS & LIBRARY PERSISTENCE
     ========================================================================== */

  exportSQL: () => exportToSQL(get().model),
  exportPrisma: () => exportToPrisma(get().model),

  saveToLibrary: async ({ title, summary, tags }) => {
    const { model, code } = get();
    if (!model.entities.length) {
      toast.error('No entities to save');
      return false;
    }

    try {
      const sqlCode = exportToSQL(model);
      const prismaCode = exportToPrisma(model);

      const content = [
        `# ${title || get().title}`,
        '',
        `> ${summary || 'ER Diagram architecture'}`,
        '',
        '## ER Diagram Definition',
        '```er',
        code,
        '```',
        '',
        '## Generated PostgreSQL DDL',
        '```sql',
        sqlCode,
        '```',
        '',
        '## Generated Prisma Schema',
        '```prisma',
        prismaCode,
        '```',
      ].join('\n');

      await libraryApi.createItem({
        type: 'note',
        title: title || get().title,
        summary: summary || 'ER Diagram architecture model',
        tags: tags || ['er-diagram', 'database', 'schema'],
        content,
      });

      toast.success('Saved ER diagram to Library!');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save to Library');
      return false;
    }
  },

  // Reset to blank
  reset: () => {
    set({
      model: createEmptyModel(),
      code: '',
      parseErrors: [],
      history: { past: [], future: [] },
      selectedEntityId: null,
      selectedRelationId: null,
      aiPreview: null,
      title: 'Untitled Schema',
    });
  },
}));

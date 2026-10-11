import { create } from 'zustand';
import { schemaApi } from '@/lib/api/schema.api.js';
import { libraryApi } from '@/lib/api/library.api.js';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/components/ui/Toast';
import { generateAllCodeOutputs, parseCodeToEntities } from '@/features/schemaDesigner/schemaSync';

export const useSchemaStore = create((set, get) => ({
  prompt: '',
  activeDialect: 'mongoose',
  currentSchema: null,
  manualLinks: [],
  telemetry: null,
  isLoading: false,
  error: null,
  isReviewModalOpen: false,
  isTelemetryDrawerOpen: false,
  selectedModel: 'flash',
  isSimulation: false,
  entityPositions: {},

  setPrompt: (prompt) => set({ prompt }),
  setActiveDialect: (dialect) => set({ activeDialect: dialect }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setIsSimulation: (isSimulation) => set({ isSimulation }),
  setReviewModalOpen: (isOpen) => set({ isReviewModalOpen: isOpen }),
  setTelemetryDrawerOpen: (isOpen) => set({ isTelemetryDrawerOpen: isOpen }),
  setEntityPositions: (positions) =>
    set((state) => ({
      entityPositions: { ...state.entityPositions, ...positions },
    })),

  // Extract all existing relationships (schema-defined + manual)
  getRelationships: () => {
    const { currentSchema, manualLinks } = get();
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

    manualLinks.forEach((ml) => {
      if (!list.some((l) => l.source === ml.source && l.sourceField === ml.sourceField && l.target === ml.target && l.targetField === ml.targetField)) {
        list.push(ml);
      }
    });

    return list;
  },

  // Manual or direct code output change
  updateCodeOutput: (dialect, newCode) =>
    set((state) => {
      if (!state.currentSchema) return state;
      return {
        currentSchema: {
          ...state.currentSchema,
          codeOutputs: {
            ...state.currentSchema.codeOutputs,
            [dialect]: newCode,
          },
        },
      };
    }),

  // Regenerate all code dialects and Mermaid diagram based on current entities and links
  rebuildCodeFromDiagram: (entities, updatedLinks) => {
    const links = updatedLinks !== undefined ? updatedLinks : get().getRelationships();
    const codes = generateAllCodeOutputs(entities, links);

    set((state) => ({
      currentSchema: state.currentSchema
        ? {
            ...state.currentSchema,
            entities,
            mermaidErDiagram: codes.mermaidErDiagram,
            codeOutputs: {
              ...state.currentSchema.codeOutputs,
              ...codes,
            },
          }
        : {
            title: 'Custom Data Model',
            summary: 'Created in NexAI Data Modeling Studio',
            entities,
            mermaidErDiagram: codes.mermaidErDiagram,
            codeOutputs: codes,
          },
    }));
  },

  // Add new entity card to canvas
  addEntity: (entityName, position) => {
    const { currentSchema, entityPositions } = get();
    const name = (entityName || '').trim() || `Entity_${(currentSchema?.entities?.length || 0) + 1}`;
    const sanitizedName = name.replace(/[^a-zA-Z0-9_]/g, '');

    const newEntity = {
      name: sanitizedName,
      description: `${sanitizedName} domain entity`,
      fields: [
        { name: 'id', type: 'UUID', isPrimary: true, isRequired: true, isUnique: true },
        { name: 'name', type: 'VARCHAR(255)', isPrimary: false, isRequired: true },
        { name: 'createdAt', type: 'TIMESTAMP', isPrimary: false, isRequired: true },
      ],
    };

    const count = currentSchema?.entities?.length || 0;
    const col = count % 3;
    const row = Math.floor(count / 3);
    const defaultPos = { x: 40 + col * 340, y: 40 + row * 300 };
    const newPositions = {
      ...entityPositions,
      [sanitizedName]: position || defaultPos,
    };

    const updatedEntities = [...(currentSchema?.entities || []), newEntity];
    set({ entityPositions: newPositions });
    get().rebuildCodeFromDiagram(updatedEntities);
    toast.success(`Added entity "${sanitizedName}"`);
  },

  // Delete entity card
  deleteEntity: (entityName) => {
    const { currentSchema, manualLinks } = get();
    if (!currentSchema) return;

    const updatedEntities = currentSchema.entities.filter((e) => e.name !== entityName);
    const updatedLinks = manualLinks.filter(
      (l) => l.source !== entityName && l.target !== entityName
    );

    set({ manualLinks: updatedLinks });
    get().rebuildCodeFromDiagram(updatedEntities, updatedLinks);
    toast.info(`Deleted entity "${entityName}"`);
  },

  // Rename entity
  renameEntity: (oldName, newName) => {
    const { currentSchema, entityPositions, manualLinks } = get();
    if (!currentSchema || !newName || oldName === newName) return;
    const sanitized = newName.trim().replace(/[^a-zA-Z0-9_]/g, '');

    const updatedEntities = currentSchema.entities.map((e) => {
      if (e.name === oldName) {
        return { ...e, name: sanitized };
      }
      return e;
    });

    const newPositions = { ...entityPositions };
    if (newPositions[oldName]) {
      newPositions[sanitized] = newPositions[oldName];
      delete newPositions[oldName];
    }

    const updatedLinks = manualLinks.map((l) => ({
      ...l,
      source: l.source === oldName ? sanitized : l.source,
      target: l.target === oldName ? sanitized : l.target,
    }));

    set({ entityPositions: newPositions, manualLinks: updatedLinks });
    get().rebuildCodeFromDiagram(updatedEntities, updatedLinks);
  },

  // Add field to entity
  addField: (entityName, fieldData) => {
    const { currentSchema } = get();
    if (!currentSchema) return;

    const newField = fieldData || {
      name: `field_${Date.now().toString().slice(-4)}`,
      type: 'VARCHAR(255)',
      isPrimary: false,
      isRequired: false,
      isUnique: false,
    };

    const updatedEntities = currentSchema.entities.map((e) => {
      if (e.name === entityName) {
        return {
          ...e,
          fields: [...(e.fields || []), newField],
        };
      }
      return e;
    });

    get().rebuildCodeFromDiagram(updatedEntities);
  },

  // Update specific field in entity
  updateField: (entityName, fieldIndex, updatedField) => {
    const { currentSchema } = get();
    if (!currentSchema) return;

    const updatedEntities = currentSchema.entities.map((e) => {
      if (e.name === entityName) {
        const nextFields = [...(e.fields || [])];
        nextFields[fieldIndex] = { ...nextFields[fieldIndex], ...updatedField };
        return { ...e, fields: nextFields };
      }
      return e;
    });

    get().rebuildCodeFromDiagram(updatedEntities);
  },

  // Delete field from entity
  deleteField: (entityName, fieldIndex) => {
    const { currentSchema, manualLinks } = get();
    if (!currentSchema) return;

    let removedFieldName = '';
    const updatedEntities = currentSchema.entities.map((e) => {
      if (e.name === entityName) {
        removedFieldName = e.fields?.[fieldIndex]?.name || '';
        const nextFields = (e.fields || []).filter((_, idx) => idx !== fieldIndex);
        return { ...e, fields: nextFields };
      }
      return e;
    });

    const updatedLinks = manualLinks.filter(
      (l) =>
        !(l.source === entityName && l.sourceField === removedFieldName) &&
        !(l.target === entityName && l.targetField === removedFieldName)
    );

    set({ manualLinks: updatedLinks });
    get().rebuildCodeFromDiagram(updatedEntities, updatedLinks);
  },

  // Add field-to-field connection
  addConnection: (connection) => {
    const { manualLinks, currentSchema } = get();
    // Validate connection
    const exists = manualLinks.some(
      (l) =>
        l.source === connection.source &&
        l.sourceField === connection.sourceField &&
        l.target === connection.target &&
        l.targetField === connection.targetField
    );

    if (exists) return;

    const updatedLinks = [...manualLinks, connection];
    set({ manualLinks: updatedLinks });

    // Mark field as foreignKey reference in entity if target field is PK or ID
    let updatedEntities = currentSchema?.entities || [];
    updatedEntities = updatedEntities.map((ent) => {
      if (ent.name === connection.source) {
        return {
          ...ent,
          fields: (ent.fields || []).map((fld) => {
            if (fld.name === connection.sourceField) {
              return {
                ...fld,
                isForeignKey: true,
                references: `${connection.target}.${connection.targetField}`,
              };
            }
            return fld;
          }),
        };
      }
      return ent;
    });

    get().rebuildCodeFromDiagram(updatedEntities, updatedLinks);
    toast.success(`Connected ${connection.source}.${connection.sourceField} → ${connection.target}.${connection.targetField}`);
  },

  // Toggle cardinality of relationship
  toggleCardinality: (connectionId) => {
    const { manualLinks, currentSchema } = get();
    const updatedLinks = manualLinks.map((l) => {
      if (l.id === connectionId) {
        const nextCard = l.cardinality === '1 : N' ? '1 : 1' : l.cardinality === '1 : 1' ? 'N : M' : '1 : N';
        return { ...l, cardinality: nextCard };
      }
      return l;
    });

    set({ manualLinks: updatedLinks });
    get().rebuildCodeFromDiagram(currentSchema?.entities || [], updatedLinks);
  },

  // Delete relationship
  deleteConnection: (connectionId) => {
    const { manualLinks, currentSchema } = get();
    const updatedLinks = manualLinks.filter((l) => l.id !== connectionId);
    set({ manualLinks: updatedLinks });
    get().rebuildCodeFromDiagram(currentSchema?.entities || [], updatedLinks);
    toast.info('Connection removed');
  },

  // Parse modified code back into diagram entities and relationships
  syncCodeToDiagram: (code, dialect) => {
    const parsed = parseCodeToEntities(code, dialect);
    if (!parsed || !parsed.entities?.length) {
      return false;
    }

    const { entityPositions } = get();
    const newPositions = { ...entityPositions };

    parsed.entities.forEach((entity, index) => {
      if (!newPositions[entity.name]) {
        const col = index % 3;
        const row = Math.floor(index / 3);
        newPositions[entity.name] = { x: 40 + col * 320, y: 40 + row * 280 };
      }
    });

    const parsedLinks = parsed.relationships || [];
    set({
      manualLinks: parsedLinks,
      entityPositions: newPositions,
    });

    get().rebuildCodeFromDiagram(parsed.entities, parsedLinks);
    return true;
  },

  generateSchema: async (customPrompt) => {
    const promptToUse = customPrompt || get().prompt;
    if (!promptToUse || !promptToUse.trim()) {
      toast.error('Please enter a description or domain requirements');
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const { selectedModel, isSimulation, currentSchema } = get();
      const existingContext = currentSchema
        ? `Previous Entities: ${currentSchema.entities.map((e) => e.name).join(', ')}`
        : '';

      const response = await schemaApi.generateSchema({
        prompt: promptToUse.trim(),
        dialects: ['mongoose', 'sql', 'prisma', 'typescript'],
        existingSchema: existingContext,
        model: selectedModel,
        isSimulation,
      });

      const payload = response?.data || response || {};
      const schema = payload.schema || payload.data?.schema || null;
      const telemetry = payload.telemetry || payload.data?.telemetry || null;

      // Extract existing relationships from the generated schema into manualLinks
      const links = [];
      (schema?.entities || []).forEach((entity) => {
        (entity.fields || []).forEach((field) => {
          if (field.references) {
            const [tgtName, tgtField = 'id'] = field.references.split('.');
            links.push({
              id: `${entity.name}.${field.name}->${tgtName}.${tgtField}`,
              source: entity.name,
              sourceField: field.name,
              target: tgtName,
              targetField: tgtField,
              cardinality: '1 : N',
            });
          }
        });
      });

      set({
        currentSchema: schema,
        manualLinks: links,
        telemetry,
        isLoading: false,
        error: null,
      });

      // Synchronize credit balance in authStore if telemetry updated
      if (telemetry?.creditsRemaining !== undefined) {
        useAuthStore.setState((state) => ({
          user: state.user
            ? {
                ...state.user,
                wallet: {
                  ...state.user.wallet,
                  creditsRemaining: telemetry.creditsRemaining,
                },
              }
            : null,
        }));
      }

      toast.success(
        `Generated schema with ${schema?.entities?.length || 0} entities (${telemetry?.creditsDeducted || 0} credits)`,
      );
    } catch (err) {
      const status = err.response?.status;
      const errorMsg =
        err.response?.data?.error?.message ||
        err.message ||
        'Failed to generate database schema';

      set({ isLoading: false, error: errorMsg });

      if (status === 402) {
        toast.error('Insufficient credits. Please recharge your wallet to continue.');
      } else {
        toast.error(errorMsg);
      }
    }
  },

  saveToLibrary: async ({ title, summary, tags }) => {
    const { currentSchema } = get();
    if (!currentSchema) {
      toast.error('No generated schema to save');
      return false;
    }

    try {
      const markdownContent = [
        `# ${title || currentSchema.title}`,
        '',
        `> ${summary || currentSchema.summary}`,
        '',
        '## Visual Entity Relationship Diagram',
        '```mermaid',
        currentSchema.mermaidErDiagram,
        '```',
        '',
        '## Mongoose Schemas (MongoDB)',
        '```javascript',
        currentSchema.codeOutputs?.mongoose || '',
        '```',
        '',
        '## PostgreSQL DDL & Constraints',
        '```sql',
        currentSchema.codeOutputs?.sql || '',
        '```',
        '',
        '## Prisma Schema',
        '```prisma',
        currentSchema.codeOutputs?.prisma || '',
        '```',
        '',
        '## TypeScript Interfaces',
        '```typescript',
        currentSchema.codeOutputs?.typescript || '',
        '```',
      ].join('\n');

      const payload = {
        type: 'note',
        title: title || currentSchema.title,
        summary: summary || currentSchema.summary,
        tags: tags && tags.length > 0 ? tags : ['schema', 'data-model', 'database'],
        content: markdownContent,
      };

      await libraryApi.createItem(payload);
      toast.success('Schema saved to your Consolidated Library!');
      set({ isReviewModalOpen: false });
      return true;
    } catch (err) {
      const errorMsg =
        err.response?.data?.error?.message ||
        err.message ||
        'Failed to save schema to Library';
      toast.error(errorMsg);
      return false;
    }
  },

  reset: () =>
    set({
      prompt: '',
      currentSchema: null,
      manualLinks: [],
      telemetry: null,
      isLoading: false,
      error: null,
      isReviewModalOpen: false,
      isTelemetryDrawerOpen: false,
    }),
}));

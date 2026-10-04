import { create } from 'zustand';
import { schemaApi } from '@/lib/api/schema.api.js';
import { libraryApi } from '@/lib/api/library.api.js';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/components/ui/Toast';

export const useSchemaStore = create((set, get) => ({
  prompt: '',
  activeDialect: 'mongoose',
  currentSchema: null,
  telemetry: null,
  isLoading: false,
  error: null,
  isReviewModalOpen: false,
  isTelemetryDrawerOpen: false,
  selectedModel: 'flash',
  isSimulation: false,

  setPrompt: (prompt) => set({ prompt }),
  setActiveDialect: (dialect) => set({ activeDialect: dialect }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setIsSimulation: (isSimulation) => set({ isSimulation }),
  setReviewModalOpen: (isOpen) => set({ isReviewModalOpen: isOpen }),
  setTelemetryDrawerOpen: (isOpen) => set({ isTelemetryDrawerOpen: isOpen }),

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

      set({
        currentSchema: schema,
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
      // Build comprehensive markdown content with Mermaid ERD and Code tabs
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
      telemetry: null,
      isLoading: false,
      error: null,
      isReviewModalOpen: false,
      isTelemetryDrawerOpen: false,
    }),
}));

import { z } from 'zod';

export const updateSettingsSchema = z.object({
  theme: z.enum(['dark', 'light']).optional(),
  defaultModel: z.enum(['flash', 'pro']).optional(),
  webSearchDefaultOn: z.boolean().optional(),
  toolExecutionMode: z.enum(['auto', 'confirm', 'manual']).optional(),
  personalization: z
    .object({
      customInstructions: z.string().max(2000).optional(),
      responseTone: z.enum(['default', 'concise', 'detailed', 'technical', 'casual']).optional(),
      aiMemoryEnabled: z.boolean().optional(),
    })
    .optional(),
});


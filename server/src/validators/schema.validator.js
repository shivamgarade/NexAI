import { z } from 'zod';

export const generateSchemaValidator = z.object({
  prompt: z
    .string({ required_error: 'Prompt is required' })
    .trim()
    .min(3, 'Prompt must be at least 3 characters')
    .max(4000, 'Prompt must not exceed 4000 characters'),
  currentCode: z
    .string()
    .max(25000, 'Current code must not exceed 25000 characters')
    .optional(),
  dialects: z
    .array(z.string())
    .optional(),
  existingSchema: z
    .string()
    .max(15000)
    .optional(),
  model: z.enum(['flash', 'pro']).optional(),
  isSimulation: z.boolean().optional(),
});

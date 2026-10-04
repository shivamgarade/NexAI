import { z } from 'zod';

export const generateSchemaValidator = z.object({
  prompt: z
    .string({ required_error: 'Prompt is required' })
    .trim()
    .min(5, 'Prompt must be at least 5 characters')
    .max(4000, 'Prompt must not exceed 4000 characters'),
  dialects: z
    .array(z.enum(['mongoose', 'sql', 'prisma', 'typescript']))
    .optional()
    .default(['mongoose', 'sql', 'prisma', 'typescript']),
  existingSchema: z
    .string()
    .max(10000, 'Existing schema must not exceed 10000 characters')
    .optional(),
  model: z.enum(['flash', 'pro']).optional(),
  isSimulation: z.boolean().optional(),
});

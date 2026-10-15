import { z } from 'zod';

export const createMemorySchema = z.object({
  fact: z
    .string({ required_error: 'Memory fact is required' })
    .trim()
    .min(2, 'Fact must be at least 2 characters')
    .max(500, 'Fact must not exceed 500 characters'),
  category: z
    .enum(['identity', 'preference', 'project', 'fact', 'instruction'])
    .optional()
    .default('fact'),
  pinned: z.boolean().optional().default(false),
  key: z.string().trim().max(100).nullable().optional(),
  scope: z.enum(['global', 'project']).optional().default('global'),
  projectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid project ID format').nullable().optional(),
});

export const updateMemorySchema = z
  .object({
    fact: z
      .string()
      .trim()
      .min(2, 'Fact must be at least 2 characters')
      .max(500, 'Fact must not exceed 500 characters')
      .optional(),
    category: z.enum(['identity', 'preference', 'project', 'instruction', 'fact']).optional(),
    pinned: z.boolean().optional(),
    active: z.boolean().optional(),
    key: z.string().trim().max(100).nullable().optional(),
    scope: z.enum(['global', 'project']).optional(),
    projectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid project ID format').nullable().optional(),
  })
  .refine(
    (data) =>
      data.fact !== undefined ||
      data.category !== undefined ||
      data.pinned !== undefined ||
      data.active !== undefined ||
      data.key !== undefined ||
      data.scope !== undefined ||
      data.projectId !== undefined,
    { message: 'At least one field must be provided to update memory' },
  );

export const memoryIdParamSchema = z.object({
  id: z
    .string({ required_error: 'Memory ID is required' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid memory ID format'),
});

import { z } from 'zod';

const toolEnum = z.enum([
  'web_search',
  'fetch_url',
  'code_execution',
  'workspace_search',
  'memory_search',
]);

const categoryEnum = z.enum([
  'Research',
  'Coding',
  'Writing',
  'Analysis',
  'Productivity',
  'General',
]);

export const createSkillSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(1, 'Title cannot be empty')
    .max(100, 'Title must not exceed 100 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must not exceed 500 characters')
    .optional()
    .default(''),
  icon: z.string().trim().max(50).optional().default('Zap'),
  instructions: z
    .string()
    .min(1, 'Instructions cannot be empty')
    .max(20000, 'Instructions must not exceed 20,000 characters')
    .optional(),
  template: z
    .string()
    .min(1, 'Template cannot be empty')
    .max(20000, 'Template must not exceed 20,000 characters')
    .optional(),
  tools: z.array(toolEnum).optional().default([]),
  category: categoryEnum.optional().default('General'),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Tag cannot be empty')
        .max(30, 'Tag must not exceed 30 characters'),
    )
    .optional()
    .default([]),
  isFavorite: z.boolean().optional().default(false),
}).refine((data) => data.instructions || data.template, {
  message: 'Either instructions or template must be provided',
  path: ['instructions'],
});

export const updateSkillSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title cannot be empty')
      .max(100, 'Title must not exceed 100 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, 'Description must not exceed 500 characters')
      .optional(),
    icon: z.string().trim().max(50).optional(),
    instructions: z
      .string()
      .min(1, 'Instructions cannot be empty')
      .max(20000, 'Instructions must not exceed 20,000 characters')
      .optional(),
    template: z
      .string()
      .min(1, 'Template cannot be empty')
      .max(20000, 'Template must not exceed 20,000 characters')
      .optional(),
    tools: z.array(toolEnum).optional(),
    category: categoryEnum.optional(),
    tags: z
      .array(
        z
          .string()
          .trim()
          .min(1, 'Tag cannot be empty')
          .max(30, 'Tag must not exceed 30 characters'),
      )
      .optional(),
    isFavorite: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const skillQuerySchema = z.object({
  category: z.string().optional(),
  tool: toolEnum.optional(),
  search: z.string().optional(),
  isFavorite: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  isSystem: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

export const skillIdParamSchema = z.object({
  id: z
    .string({ required_error: 'Skill ID is required' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Skill ID format'),
});

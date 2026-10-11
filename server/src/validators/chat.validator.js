import { z } from 'zod';

export const createChatSchema = z.object({
  title: z.string().trim().max(100, 'Title must not exceed 100 characters').optional(),
  projectId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid project ID format')
    .nullable()
    .optional(),
});

export const updateChatSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title cannot be empty')
      .max(100, 'Title must not exceed 100 characters')
      .optional(),
    projectId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid project ID format')
      .nullable()
      .optional(),
    pinned: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined || data.projectId !== undefined || data.pinned !== undefined,
    { message: 'At least one field (title, projectId, pinned) must be provided' },
  );

export const sendMessageSchema = z.object({
  content: z
    .string({ required_error: 'Message content is required' })
    .trim()
    .min(1, 'Message content cannot be empty'),
  model: z.enum(['flash', 'pro']).optional(),
  thinkingLevel: z.enum(['off', 'low', 'medium', 'high']).optional(),
  isSimulation: z.boolean().optional(),
  attachments: z.array(z.object({
    name: z.string().optional(),
    mimeType: z.string(),
    data: z.string().optional(),
    size: z.number().optional(),
  })).nullish(),
});

export const chatIdParamSchema = z.object({
  id: z
    .string({ required_error: 'Chat ID is required' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid chat ID format'),
});

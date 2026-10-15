import { z } from 'zod';

const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createScheduleSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(1, 'Title cannot be empty')
    .max(120, 'Title cannot exceed 120 characters'),
  description: z.string().trim().max(300).optional().default(''),
  instructions: z
    .string({ required_error: 'Instructions are required' })
    .trim()
    .min(1, 'Instructions cannot be empty')
    .max(4000, 'Instructions cannot exceed 4000 characters'),
  frequency: z.enum(['daily', 'weekly', 'once']).default('daily'),
  weeklyDays: z.array(z.number().int().min(0).max(6)).optional().default([1, 2, 3, 4, 5]),
  runTime: z.string().regex(timeRegex, 'Time must be in HH:mm 24-hour format').default('09:00'),
  isActive: z.boolean().optional().default(true),
  model: z.enum(['flash', 'pro']).optional().default('flash'),
  deliveryTarget: z.enum(['chat', 'library']).optional().default('chat'),
});

export const updateScheduleSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(300).optional(),
  instructions: z.string().trim().min(1).max(4000).optional(),
  frequency: z.enum(['daily', 'weekly', 'once']).optional(),
  weeklyDays: z.array(z.number().int().min(0).max(6)).optional(),
  runTime: z.string().regex(timeRegex, 'Time must be in HH:mm 24-hour format').optional(),
  isActive: z.boolean().optional(),
  model: z.enum(['flash', 'pro']).optional(),
  deliveryTarget: z.enum(['chat', 'library']).optional(),
});

export const scheduleIdParamSchema = z.object({
  id: z
    .string({ required_error: 'Schedule ID is required' })
    .regex(objectIdRegex, 'Invalid Schedule ID format'),
});

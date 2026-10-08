import { z } from 'zod';

export const startInterviewSchema = z.object({
  role: z
    .string({ required_error: 'Role is required' })
    .trim()
    .min(2, 'Role must be at least 2 characters')
    .max(100, 'Role must not exceed 100 characters'),
  difficulty: z.enum(['junior', 'mid', 'senior'], {
    required_error: 'Difficulty level is required (junior, mid, senior)',
  }),
  topic: z
    .string({ required_error: 'Topic is required' })
    .trim()
    .min(2, 'Topic must be at least 2 characters')
    .max(200, 'Topic must not exceed 200 characters'),
  model: z.enum(['flash', 'pro']).optional(),
  isSimulation: z.boolean().optional(),
});

export const respondInterviewSchema = z.object({
  content: z
    .string({ required_error: 'Response content is required' })
    .trim()
    .min(1, 'Response content cannot be empty')
    .max(8000, 'Response content cannot exceed 8000 characters'),
  model: z.enum(['flash', 'pro']).optional(),
  isSimulation: z.boolean().optional(),
});

export const interviewIdParamSchema = z.object({
  id: z
    .string({ required_error: 'Interview ID is required' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid interview ID format'),
});

export const interviewTtsSchema = z.object({
  text: z
    .string({ required_error: 'Text is required for TTS synthesis' })
    .trim()
    .min(1, 'Text cannot be empty')
    .max(5000, 'Text must not exceed 5000 characters'),
  engine: z.enum(['edge', 'gemini']).default('edge').optional(),
  voice: z.string().trim().max(100).optional(),
  style: z.string().trim().max(200).optional(),
  sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid session ID format').optional(),
  isSimulation: z.boolean().optional(),
});


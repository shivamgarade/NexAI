import { z } from 'zod';

export const updateSettingsSchema = z.object({
  theme: z.enum(['dark', 'light']).optional(),
  defaultModel: z.enum(['flash', 'pro']).optional(),
  webSearchDefaultOn: z.boolean().optional(),
  thinkingLevel: z.enum(['off', 'dynamic', 'low', 'medium', 'high']).optional(),
  smartTokenOptimization: z.boolean().optional(),
  maxContextTurns: z.number().min(5).max(50).optional(),
  conversationWidth: z.enum(['narrow', 'default', 'wide', 'fill']).optional(),
  contrast: z.enum(['default', 'strong']).optional(),
  screenReaderMode: z.boolean().optional(),
  conversationSteps: z.enum(['default', 'verbose']).optional(),
  font: z.string().max(50).optional(),
  fontSize: z.string().max(20).optional(),
  themePresetLight: z.string().max(50).optional(),
  themePresetDark: z.string().max(50).optional(),
  customColors: z.record(z.string()).optional(),
  interviewGuardrailLevel: z.enum(['strict_socratic', 'guided', 'direct']).optional(),
  toolExecutionMode: z.enum(['auto', 'confirm', 'manual']).optional(),
  personalization: z
    .object({
      customInstructions: z.string().max(2000).optional(),
      responseTone: z.enum(['default', 'concise', 'detailed', 'technical', 'casual']).optional(),
      aiMemoryEnabled: z.boolean().optional(),
    })
    .optional(),
});


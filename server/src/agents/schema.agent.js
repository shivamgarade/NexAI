import { z } from 'zod';
import { generateContent } from '../services/gemini.service.js';
import { SCHEMA_SYSTEM_PROMPT } from './prompts/schema.prompt.js';
import { logger } from '../utils/logger.js';

const schemaResultSchema = z.object({
  code: z.string(),
  summary: z.string().default('Generated ER Diagram architecture'),
});

/**
 * Strips markdown code fences (```json ... ```) and parses the JSON.
 * @param {string} text
 * @returns {any}
 */
function parseJsonOutput(text) {
  let cleaned = (text || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }
  return JSON.parse(cleaned);
}

/**
 * Offline simulated fallback ER model
 * @param {string} prompt
 * @returns {{ code: string, summary: string }}
 */
function getSimulatedErCode(prompt) {
  const isSaas = /saas|tenant|org|workspace/i.test(prompt);

  if (isSaas) {
    return {
      code: `organizations [color: purple] {
  id uuid pk
  name string
  plan string
  createdAt datetime
}

users [color: blue] {
  id uuid pk
  orgId uuid
  email string unique
  name string
}

projects [color: green] {
  id uuid pk
  orgId uuid
  name string
}

users.orgId > organizations.id
projects.orgId > organizations.id`,
      summary: 'Multi-tenant SaaS ER model with Organizations, Users, and Projects.',
    };
  }

  return {
    code: `users [color: blue] {
  id uuid pk
  email string unique
  name string
  createdAt datetime
}

orders [color: green] {
  id uuid pk
  userId uuid
  status string
  total decimal
  createdAt datetime
}

order_items {
  id uuid pk
  orderId uuid
  productId uuid
  quantity int
  price decimal
}

products [color: orange] {
  id uuid pk
  title string
  sku string unique
  price decimal
}

orders.userId > users.id
order_items.orderId > orders.id
order_items.productId > products.id`,
    summary: 'Normalized e-commerce ER model with Users, Orders, OrderItems, and Products.',
  };
}

/**
 * Generates an ER model using Gemini AI in the Eraser ER language.
 *
 * @param {object} params
 * @param {string} params.prompt
 * @param {string} [params.currentCode]
 * @param {string} [params.model]
 * @param {boolean} [params.isSimulation]
 * @returns {Promise<{ code: string, summary: string, tokensUsed: number }>}
 */
export async function generateDatabaseSchema({
  prompt,
  currentCode = '',
  model = 'flash',
  isSimulation = false,
}) {
  if (isSimulation) {
    const sim = getSimulatedErCode(prompt);
    return {
      code: sim.code,
      summary: sim.summary,
      tokensUsed: 0,
    };
  }

  const userContent = [
    `User Requirements: ${prompt}`,
    currentCode ? `Current ER Code:\n${currentCode}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const result = await generateContent({
      prompt: userContent,
      systemInstruction: SCHEMA_SYSTEM_PROMPT,
      model,
      temperature: 0.2,
      responseMimeType: 'application/json',
    });

    const parsedJson = parseJsonOutput(result.text);
    const validated = schemaResultSchema.parse(parsedJson);

    return {
      code: validated.code,
      summary: validated.summary,
      tokensUsed: result.totalTokens || 0,
    };
  } catch (err) {
    logger.warn({ err }, 'Gemini ER model generation failed, falling back to simulated model');
    const fallback = getSimulatedErCode(prompt);
    return {
      code: fallback.code,
      summary: fallback.summary,
      tokensUsed: 0,
    };
  }
}

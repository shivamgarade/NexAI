import { GoogleGenAI } from '@google/genai';
import { env } from './env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

let geminiClient = null;

/**
 * Returns a singleton instance of the GoogleGenAI client.
 * Throws ApiError if GEMINI_API_KEY is missing.
 *
 * @returns {GoogleGenAI}
 */
export function getGeminiClient() {
  if (!env.GEMINI_API_KEY) {
    throw new ApiError(
      500,
      'GEMINI_NOT_CONFIGURED',
      'GEMINI_API_KEY is not configured in server/.env',
    );
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }

  return geminiClient;
}

/**
 * Resolves the configured Gemini model name from environment variables.
 * Model names are never hard-coded.
 *
 * @param {'flash' | 'pro'} [type='flash']
 * @returns {string} Configured model identifier
 */
export function getModelName(type = 'flash') {
  if (type === 'pro') {
    return env.GEMINI_PRO_MODEL || 'gemini-3.1-pro-preview';
  }
  if (type === 'embed') {
    return env.GEMINI_EMBED_MODEL || 'text-embedding-004';
  }
  if (type === 'tts') {
    return env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts';
  }
  return env.GEMINI_FLASH_MODEL || 'gemini-3.1-flash-lite';
}

if (!env.GEMINI_API_KEY && env.NODE_ENV !== 'test') {
  logger.warn('⚠️ GEMINI_API_KEY is not configured in server/.env. AI calls will fail until set.');
}

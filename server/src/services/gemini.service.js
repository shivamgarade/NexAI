import { getGeminiClient, getModelName } from '../config/gemini.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

/**
 * Parses raw Gemini SDK errors and extracts clean, user-friendly messages and status codes.
 *
 * @param {any} error
 * @returns {ApiError}
 */
export function parseGeminiError(error) {
  if (error instanceof ApiError) return error;

  let statusCode = 502;
  let code = 'GEMINI_API_ERROR';
  let message = 'Failed to generate response from Gemini';

  const rawMessage = error?.message || '';

  try {
    let parsed = JSON.parse(rawMessage);
    let attempts = 0;
    while (parsed && typeof parsed === 'object' && attempts < 5) {
      attempts++;
      if (parsed.error && typeof parsed.error === 'object') {
        parsed = parsed.error;
        continue;
      }
      if (typeof parsed.message === 'string' && parsed.message.trim().startsWith('{')) {
        try {
          parsed = JSON.parse(parsed.message);
          continue;
        } catch {
          // not JSON, keep string
        }
      }
      if (parsed.code) statusCode = Number(parsed.code) || statusCode;
      if (parsed.status) code = String(parsed.status);
      if (parsed.message) message = String(parsed.message);
      break;
    }
  } catch {
    if (rawMessage) {
      message = rawMessage;
    }
  }

  // Friendly messages for high demand spikes (503) or rate limits (429)
  if (
    statusCode === 503 ||
    rawMessage.includes('503') ||
    rawMessage.includes('high demand') ||
    code === 'UNAVAILABLE'
  ) {
    statusCode = 503;
    code = 'SERVICE_UNAVAILABLE';
    message =
      'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again in a few moments.';
  } else if (statusCode === 429 || rawMessage.includes('429') || code === 'RESOURCE_EXHAUSTED') {
    statusCode = 429;
    code = 'RATE_LIMIT_EXCEEDED';
    message = 'Rate limit exceeded. Please wait a moment before sending another message.';
  } else if (
    statusCode === 401 ||
    code === 'UNAUTHENTICATED' ||
    rawMessage.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') ||
    rawMessage.includes('invalid authentication credentials')
  ) {
    statusCode = 401;
    code = 'INVALID_API_KEY';
    message =
      'Invalid Gemini API key. Please configure a valid Google AI Studio API key (starts with "AIzaSy...") in server/.env, or toggle Simulation Mode ("Sim" button) to test offline without an API key.';
  }

  return new ApiError(statusCode, code, message);
}

/**
 * Streams content from Gemini with real token usage reporting and automatic transient retry.
 *
 * @param {Object} options
 * @param {Array<{role: string, parts: Array<{text: string}>}> | string} options.contents - Conversation history
 * @param {'flash' | 'pro'} [options.model='flash'] - Model tier
 * @param {string} [options.systemInstruction] - System instruction
 * @param {Record<string, unknown>} [options.config] - Additional SDK config
 * @returns {AsyncGenerator<{text: string, usageMetadata: any}, void, unknown>}
 */
export async function* streamContent({
  contents,
  model = 'flash',
  systemInstruction,
  config = {},
}) {
  const client = getGeminiClient();
  const modelName = getModelName(model);

  let stream = null;
  let attempt = 0;
  const maxRetries = 1;

  while (true) {
    try {
      stream = await client.models.generateContentStream({
        model: modelName,
        contents,
        config: {
          ...(systemInstruction ? { systemInstruction } : {}),
          ...config,
        },
      });
      break;
    } catch (err) {
      attempt++;
      const isTransient =
        err.message?.includes('503') ||
        err.message?.includes('UNAVAILABLE') ||
        err.message?.includes('high demand');

      if (isTransient && attempt <= maxRetries) {
        logger.warn(
          { attempt, maxRetries },
          'Transient Gemini 503 high demand spike, retrying after 1s...',
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      logger.error({ error: err.message }, 'Gemini stream initialization error');
      throw parseGeminiError(err);
    }
  }

  try {
    for await (const chunk of stream) {
      const usageMetadata = chunk.usageMetadata || null;
      let text = '';
      let thought = '';

      const parts = chunk.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.thought && typeof part.text === 'string') {
          thought += part.text;
        } else if (!part.thought && typeof part.text === 'string') {
          text += part.text;
        }
      }

      // Fallback if parts array was empty or didn't isolate text
      if (!text && !thought && chunk.text) {
        text = chunk.text;
      }

      if (text || thought || usageMetadata) {
        yield { text, thought, usageMetadata };
      }
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Gemini stream iteration error');
    throw parseGeminiError(error);
  }
}

/**
 * Generates a non-streaming completion from Gemini (e.g. for title generation, tagging).
 *
 * @param {Object} options
 * @param {Array<{role: string, parts: Array<{text: string}>}> | string} options.contents
 * @param {'flash' | 'pro'} [options.model='flash']
 * @param {string} [options.systemInstruction]
 * @param {Record<string, unknown>} [options.config]
 * @returns {Promise<{text: string, totalTokens: number, usageMetadata: any}>}
 */
export async function generateContent({
  contents,
  model = 'flash',
  systemInstruction,
  config = {},
}) {
  const client = getGeminiClient();
  const modelName = getModelName(model);

  let attempt = 0;
  const maxRetries = 1;

  while (true) {
    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents,
        config: {
          ...(systemInstruction ? { systemInstruction } : {}),
          ...config,
        },
      });

      const text = response.text || '';
      const usageMetadata = response.usageMetadata || null;
      const totalTokens =
        usageMetadata?.totalTokenCount ??
        (usageMetadata?.promptTokenCount || 0) + (usageMetadata?.candidatesTokenCount || 0);

      return {
        text,
        totalTokens,
        usageMetadata,
      };
    } catch (error) {
      attempt++;
      const isTransient =
        error.message?.includes('503') ||
        error.message?.includes('UNAVAILABLE') ||
        error.message?.includes('high demand');

      if (isTransient && attempt <= maxRetries) {
        logger.warn(
          { attempt, maxRetries },
          'Transient Gemini 503 high demand spike, retrying after 1s...',
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      logger.error({ error: error.message }, 'Gemini generation error');
      throw parseGeminiError(error);
    }
  }
}

/**
 * Generates vector embeddings for a given text or content string.
 *
 * @param {Object} options
 * @param {string} options.contents - Text to embed
 * @param {string} [options.model='embed'] - Model type
 * @returns {Promise<Array<number>>} Vector embedding values
 */
export async function embedContent({ contents, model = 'embed' }) {
  const client = getGeminiClient();
  const modelName = getModelName(model);

  let attempt = 0;
  const maxRetries = 1;

  while (true) {
    try {
      const response = await client.models.embedContent({
        model: modelName,
        contents,
      });

      const embeddingValues = response.embedding?.values || [];
      return embeddingValues;
    } catch (error) {
      attempt++;
      const isTransient =
        error.message?.includes('503') ||
        error.message?.includes('UNAVAILABLE') ||
        error.message?.includes('high demand');

      if (isTransient && attempt <= maxRetries) {
        logger.warn(
          { attempt, maxRetries },
          'Transient Gemini 503 high demand spike during embedding, retrying after 1s...',
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      logger.error({ error: error.message }, 'Gemini embedding error');
      throw parseGeminiError(error);
    }
  }
}

/**
 * Generates text-to-speech audio using Gemini TTS (gemini-3.8-flash-lite-tts).
 * Returns decoded WAV audio buffer and token usage metadata.
 *
 * @param {Object} options
 * @param {string} options.text - Transcript text to speak
 * @param {string} [options.voice='Kore'] - Speaker voice name (e.g. Kore, Puck, Zephyr, Fenrir)
 * @param {string} [options.style='professional and conversational'] - Vocal tone/delivery style
 * @returns {Promise<{ audioBuffer: Buffer, mimeType: string, totalTokens: number, usageMetadata: any }>}
 */
export async function generateSpeech({
  text,
  voice = 'Kore',
  style = 'professional and engaging',
}) {
  const client = getGeminiClient();
  const modelName = getModelName('tts');

  let attempt = 0;
  const maxRetries = 1;

  while (true) {
    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text,
                speech_metadata: {
                  speaker: voice,
                  style,
                },
              },
            ],
          },
        ],
      });

      const part = response.candidates?.[0]?.content?.parts?.[0];
      const base64Data =
        part?.inlineData?.data ||
        response.output_audio?.data ||
        null;

      if (!base64Data) {
        throw new ApiError(502, 'GEMINI_TTS_ERROR', 'No audio data received from Gemini TTS model');
      }

      const mimeType = part?.inlineData?.mimeType || 'audio/wav';
      const audioBuffer = Buffer.from(base64Data, 'base64');

      const usageMetadata = response.usageMetadata || null;
      const promptTokens = usageMetadata?.promptTokenCount || 0;
      const candidatesTokens = usageMetadata?.candidatesTokenCount || 0;
      const totalTokens =
        usageMetadata?.totalTokenCount ?? (promptTokens + candidatesTokens);

      return {
        audioBuffer,
        mimeType,
        totalTokens: Math.max(1, totalTokens),
        usageMetadata,
      };
    } catch (error) {
      attempt++;
      const isTransient =
        error.message?.includes('503') ||
        error.message?.includes('UNAVAILABLE') ||
        error.message?.includes('high demand');

      if (isTransient && attempt <= maxRetries) {
        logger.warn(
          { attempt, maxRetries },
          'Transient Gemini 503 high demand spike during TTS generation, retrying after 1s...',
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      logger.error({ error: error.message }, 'Gemini speech generation error');
      throw parseGeminiError(error);
    }
  }
}


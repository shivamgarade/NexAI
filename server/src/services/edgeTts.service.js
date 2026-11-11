import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { logger } from '../utils/logger.js';

export const EDGE_VOICES = {
  MALE: 'en-US-ChristopherNeural',
  MALE_ALT: 'en-US-GuyNeural',
  FEMALE: 'en-US-JennyNeural',
  HINDI_MALE: 'hi-IN-MadhurNeural',
  HINDI_FEMALE: 'hi-IN-SwaraNeural',
};

export const DEFAULT_EDGE_VOICE = EDGE_VOICES.MALE;

/**
 * Automatically detects whether text contains Devanagari (Hindi) characters.
 * If so, selects a Hindi neural voice to avoid Edge TTS 0-byte synthesis failure.
 */
function resolveEdgeVoice(text, requestedVoice) {
  const hasDevanagari = /[\u0900-\u097F]/.test(text || '');
  if (hasDevanagari) {
    if (requestedVoice?.toLowerCase().includes('female') || requestedVoice?.toLowerCase().includes('jenny')) {
      return EDGE_VOICES.HINDI_FEMALE;
    }
    return EDGE_VOICES.HINDI_MALE;
  }
  return requestedVoice || DEFAULT_EDGE_VOICE;
}

/**
 * Safely escapes characters that break SSML XML parsing in Microsoft Edge TTS.
 * Handles &, <, >, ", and ' without double-escaping valid XML entities.
 */
function escapeXmlForSsml(str) {
  return str
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Synthesizes speech using Microsoft Edge Neural TTS.
 * Ultra-low latency, studio-grade 24 kHz MP3, 100% free, zero token/credit cost.
 *
 * @param {Object} options
 * @param {string} options.text - Text content to synthesize
 * @param {string} [options.voice] - Edge voice identifier
 * @returns {Promise<{ audioBuffer: Buffer, mimeType: string, voice: string }>}
 */
export async function synthesizeEdgeSpeech({ text, voice = DEFAULT_EDGE_VOICE } = {}) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Text is required for Edge TTS synthesis');
  }

  const selectedVoice = resolveEdgeVoice(text, voice);
  const tts = new MsEdgeTTS();

  try {
    await tts.setMetadata(
      selectedVoice,
      OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
    );

    const sanitizedText = escapeXmlForSsml(text.trim());
    const { audioStream } = tts.toStream(sanitizedText);

    const chunks = [];
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        try {
          tts.close();
        } catch {
          // ignore
        }
        reject(new Error('Edge TTS synthesis timed out after 30 seconds'));
      }, 30000);

      audioStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      audioStream.on('end', () => {
        clearTimeout(timeout);
        try {
          tts.close();
        } catch {
          // ignore
        }
        const audioBuffer = Buffer.concat(chunks);
        if (audioBuffer.length === 0) {
          reject(new Error('Edge TTS returned 0 audio bytes'));
          return;
        }
        resolve({
          audioBuffer,
          mimeType: 'audio/mpeg',
          voice: selectedVoice,
        });
      });

      audioStream.on('error', (err) => {
        clearTimeout(timeout);
        try {
          tts.close();
        } catch {
          // ignore
        }
        reject(err);
      });
    });
  } catch (error) {
    try {
      tts.close();
    } catch {
      // ignore
    }
    logger.error({ error: error.message, voice: selectedVoice }, 'Edge Neural TTS synthesis failed');
    throw error;
  }
}

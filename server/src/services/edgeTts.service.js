import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { logger } from '../utils/logger.js';

export const EDGE_VOICES = {
  MALE: 'en-US-ChristopherNeural',
  MALE_ALT: 'en-US-GuyNeural',
  FEMALE: 'en-US-JennyNeural',
};

export const DEFAULT_EDGE_VOICE = EDGE_VOICES.MALE;

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

  const selectedVoice = voice || DEFAULT_EDGE_VOICE;
  const tts = new MsEdgeTTS();

  try {
    await tts.setMetadata(
      selectedVoice,
      OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
    );

    const { audioStream } = tts.toStream(text.trim());

    const chunks = [];
    return await new Promise((resolve, reject) => {
      audioStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      audioStream.on('end', () => {
        try {
          tts.close();
        } catch {
          // ignore
        }
        const audioBuffer = Buffer.concat(chunks);
        resolve({
          audioBuffer,
          mimeType: 'audio/mpeg',
          voice: selectedVoice,
        });
      });

      audioStream.on('error', (err) => {
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

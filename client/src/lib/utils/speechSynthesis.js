/**
 * Client-Side Microsoft Edge Neural Speech Synthesis Utility
 *
 * Powers natural, studio-grade conversational voice using the high-fidelity
 * Microsoft Edge Neural TTS service (0 credits / 100% free via msedge-tts),
 * exactly like the interview section and message read-aloud feature.
 * Automatically falls back to client Web Speech API if offline.
 */
import { interviewApi } from '@/lib/api/interview.api';

let activeAudio = null;
let activeAbortController = null;

/**
 * Strips markdown symbols, code blocks, URLs, and formatting artifacts
 * so spoken speech sounds fluid, clear, and natural.
 *
 * @param {string} raw - Raw markdown response text
 * @returns {string} Sanitized plain speech text
 */
export function sanitizeForSpeech(raw) {
  if (!raw) return '';
  return raw
    .replace(/```[\s\S]*?```/g, ' Code snippet omitted. ') // Don't speak raw code blocks
    .replace(/`([^`]+)`/g, '$1') // Strip inline backticks
    .replace(/\\\[[\s\S]*?\\\]/g, ' ') // Strip LaTeX display formulas
    .replace(/\\\([\s\S]*?\\\)/g, ' ') // Strip LaTeX inline formulas
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$([^\$]+)\$/g, '$1')
    .replace(/#{1,6}\s+/g, '') // Strip markdown heading markers
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // Strip bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // Strip italics
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Strip markdown links, speak link text
    .replace(/https?:\/\/\S+/g, 'link') // Don't spell out full URLs
    .replace(/^\s*[-*+]\s+/gm, '') // Strip bullet points
    .replace(/^\s*\d+\.\s+/gm, '') // Strip list numbers
    .replace(/^\s*>\s+/gm, '') // Strip blockquote markers
    .replace(/\|.*?\|/g, '') // Strip raw table cells
    .replace(/[~^_]/g, ' ') // Strip stray markdown operators
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns the best available natural/neural voice from the browser's speech synthesis engine.
 * Prioritizes Microsoft Natural / Online Neural voices (Edge / Windows 11),
 * Google US English (Chrome), and standard English voices.
 *
 * @returns {SpeechSynthesisVoice|null}
 */
export function getBestSpeechVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. Prioritize Microsoft Natural / Online Neural voices (Edge / Windows 11)
  const natural = voices.find(
    (v) =>
      v.lang.startsWith('en') &&
      (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Neural'))
  );
  if (natural) return natural;

  // 2. Google US English (Chrome)
  const google = voices.find((v) => v.name.includes('Google') && v.lang.startsWith('en'));
  if (google) return google;

  // 3. Samantha / Daniel / Siri voices (Safari / macOS)
  const appleNatural = voices.find(
    (v) => (v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Siri')) && v.lang.startsWith('en')
  );
  if (appleNatural) return appleNatural;

  // 4. Any clean en-US / en-GB English voice
  const standardEnglish = voices.find(
    (v) => v.lang === 'en-US' || v.lang === 'en-GB' || v.lang.startsWith('en')
  );
  if (standardEnglish) return standardEnglish;

  return voices[0] || null;
}

/**
 * Speaks text using the browser's native speech synthesis engine.
 *
 * @param {string} text - Text to speak
 * @param {Object} options
 * @param {Function} [options.onStart] - Callback when speech starts
 * @param {Function} [options.onEnd] - Callback when speech completes
 * @param {Function} [options.onError] - Callback on error
 * @returns {SpeechSynthesisUtterance|null}
 */
/**
 * Speaks text using the high-fidelity Microsoft Edge Neural TTS engine (msedge-tts).
 * Produces authentic 24 kHz natural human-sounding audio exactly like the interview section.
 * Falls back to browser Web Speech API if network is unavailable.
 *
 * @param {string} text - Text to speak
 * @param {Object} options
 * @param {Function} [options.onStart] - Callback when speech starts
 * @param {Function} [options.onEnd] - Callback when speech completes
 * @param {Function} [options.onError] - Callback on error
 * @param {string} [options.voice='en-US-ChristopherNeural'] - Neural voice identifier
 */
export async function speakText(
  text,
  { onStart, onEnd, onError, voice = 'en-US-ChristopherNeural' } = {},
) {
  cancelSpeech();

  const clean = sanitizeForSpeech(text);
  if (!clean) {
    onEnd?.();
    return null;
  }

  const abortController = new AbortController();
  activeAbortController = abortController;

  try {
    // 1. Studio-grade Microsoft Edge Neural TTS (~350ms low latency, human conversational sound)
    const textChunk = clean.slice(0, 1000);
    const response = await interviewApi.synthesizeSpeech({
      text: textChunk,
      engine: 'edge',
      voice,
    });

    if (abortController.signal.aborted) {
      return null;
    }

    const rawData = response?.data ?? response;
    const audioBlob =
      rawData instanceof Blob
        ? rawData.type
          ? rawData
          : new Blob([rawData], { type: 'audio/mpeg' })
        : new Blob([rawData], { type: 'audio/mpeg' });

    if (!audioBlob || (audioBlob.size !== undefined && audioBlob.size === 0)) {
      throw new Error('Empty audio stream received from Edge Neural TTS');
    }

    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    activeAudio = audio;

    let ended = false;
    const cleanup = () => {
      if (!ended) {
        ended = true;
        try {
          URL.revokeObjectURL(audioUrl);
        } catch {
          // ignore
        }
        if (activeAudio === audio) {
          activeAudio = null;
        }
        onEnd?.();
      }
    };

    audio.onplay = () => {
      onStart?.();
    };
    audio.onended = cleanup;
    audio.onerror = () => {
      cleanup();
      fallbackBrowserSpeech(clean, { onStart, onEnd, onError });
    };

    await audio.play();
    return audio;
  } catch (err) {
    if (abortController.signal.aborted) {
      return null;
    }
    console.warn('Edge Neural TTS network playback fallback to browser speech synthesis:', err);
    return fallbackBrowserSpeech(clean, { onStart, onEnd, onError });
  }
}

/**
 * Fallback browser speech synthesis for offline / network failure scenarios.
 */
function fallbackBrowserSpeech(cleanText, { onStart, onEnd, onError } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onEnd?.();
    return null;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voice = getBestSpeechVoice();
    if (voice) {
      utterance.voice = voice;
    }
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      onStart?.();
    };
    utterance.onend = () => {
      onEnd?.();
    };
    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        onError?.(e);
      } else {
        onEnd?.();
      }
    };

    window.__nexaiActiveUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return utterance;
  } catch (err) {
    onError?.(err);
    return null;
  }
}

/**
 * Cancels any active Edge Neural audio playback or SpeechSynthesis readout immediately.
 */
export function cancelSpeech() {
  if (activeAbortController) {
    try {
      activeAbortController.abort();
    } catch {
      // ignore
    }
    activeAbortController = null;
  }
  if (activeAudio) {
    try {
      activeAudio.pause();
      if (activeAudio.src) {
        URL.revokeObjectURL(activeAudio.src);
      }
      activeAudio.src = '';
    } catch {
      // ignore
    }
    activeAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
    window.__nexaiActiveUtterance = null;
  }
}

/**
 * Checks if speech synthesis is supported in the current environment.
 */
export function isSpeechSynthesisSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

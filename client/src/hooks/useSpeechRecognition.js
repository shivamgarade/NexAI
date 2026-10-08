import { useState, useRef, useEffect, useCallback } from 'react';
import {
  playMicStartSound,
  playMicStopSound,
  playTextAddedSound,
} from '@/lib/utils/audioFeedback';

/**
 * Custom hook for Web Speech API speech-to-text dictation.
 * Safe in SSR / unsupported browser environments with automatic feature detection.
 * Handles continuous dictation, silence pauses without premature abort, smooth word capture,
 * and audio confirmation cues for start, stop, and text addition.
 *
 * @param {Object} options
 * @param {Function} [options.onResult] - Callback fired with newly transcribed text chunks
 * @param {Function} [options.onError] - Callback fired when recognition errors
 * @param {boolean} [options.continuous=true] - Keep listening across pauses
 * @param {string} [options.lang='en-US'] - Language locale
 * @param {boolean} [options.soundFeedback=true] - Whether to play auditory confirmation cues
 */
export function useSpeechRecognition({
  onResult,
  onInterim,
  onError,
  continuous = true,
  lang = 'en-US',
  soundFeedback = true,
} = {}) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  const onErrorRef = useRef(onError);
  const isUserActiveRef = useRef(false);
  const pendingInterimRef = useRef('');
  const lastFinalIndexRef = useRef(-1);
  const lastCommittedTextRef = useRef('');
  const lastCommittedTimeRef = useRef(0);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    onInterimRef.current = onInterim;
  }, [onInterim]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const isSupported =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const stopListening = useCallback(() => {
    const wasActive = isUserActiveRef.current || isListening;
    isUserActiveRef.current = false;
    pendingInterimRef.current = '';

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop on inactive instance
      }
    }
    setIsListening(false);
    if (wasActive && soundFeedback) {
      playMicStopSound();
    }
  }, [isListening, soundFeedback]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      const errMsg = 'Voice input not supported in this browser';
      setError(errMsg);
      onErrorRef.current?.(errMsg);
      return;
    }

    try {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      isUserActiveRef.current = true;
      pendingInterimRef.current = '';
      lastFinalIndexRef.current = -1;
      lastCommittedTextRef.current = '';
      lastCommittedTimeRef.current = 0;

      if (soundFeedback) {
        playMicStartSound();
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = continuous;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event) => {
        let finalChunk = '';
        let interimChunk = '';

        // Strictly evaluate only items after the last finalized index
        const startIndex = Math.max(0, lastFinalIndexRef.current + 1);
        for (let i = startIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (!res) continue;
          const transcript = res[0]?.transcript?.trim();
          if (!transcript) continue;

          if (res.isFinal) {
            finalChunk += (finalChunk ? ' ' : '') + transcript;
            lastFinalIndexRef.current = i;
          } else {
            interimChunk += (interimChunk ? ' ' : '') + transcript;
          }
        }

        // Commit newly finalized chunk without duplicate repeats
        if (finalChunk) {
          const now = Date.now();
          const isRapidDuplicate =
            finalChunk === lastCommittedTextRef.current &&
            now - lastCommittedTimeRef.current < 1500;

          if (!isRapidDuplicate) {
            lastCommittedTextRef.current = finalChunk;
            lastCommittedTimeRef.current = now;
            pendingInterimRef.current = '';

            if (soundFeedback) {
              playTextAddedSound();
            }
            onResultRef.current?.(finalChunk);
          }
        }

        pendingInterimRef.current = interimChunk;

        if (interimChunk) {
          onInterimRef.current?.(interimChunk);
        } else if (finalChunk) {
          onInterimRef.current?.('');
        }
      };

      recognition.onerror = (event) => {
        // 'no-speech' is triggered when the user pauses naturally while dictating.
        // Do not abort or set listening to false for 'no-speech' or 'aborted'.
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }

        const errMsg = event.error || 'Speech recognition error';
        setError(errMsg);
        onErrorRef.current?.(errMsg);
        if (isUserActiveRef.current && soundFeedback) {
          playMicStopSound();
        }
        isUserActiveRef.current = false;
        setIsListening(false);
      };

      recognition.onend = () => {
        // If user is still dictating (hasn't stopped manually), auto-restart
        // to prevent Chromium from dropping speech after short silence
        if (isUserActiveRef.current) {
          try {
            lastFinalIndexRef.current = -1;
            pendingInterimRef.current = '';
            recognition.start();
            return;
          } catch {
            // If restart fails, fall back to inactive state
          }
        }
        pendingInterimRef.current = '';
        if (isUserActiveRef.current && soundFeedback) {
          playMicStopSound();
        }
        isUserActiveRef.current = false;
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      const errMsg = err?.message || 'Failed to start speech recognition';
      setError(errMsg);
      onErrorRef.current?.(errMsg);
      isUserActiveRef.current = false;
      setIsListening(false);
    }
  }, [isSupported, continuous, lang, soundFeedback]);

  const toggleListening = useCallback(() => {
    if (isListening || isUserActiveRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Teardown on unmount
  useEffect(() => {
    return () => {
      isUserActiveRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}

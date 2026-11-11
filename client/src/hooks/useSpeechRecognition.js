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

  const errorCountRef = useRef(0);
  const lastErrorTimeRef = useRef(0);
  const spawnRecognitionRef = useRef(null);

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
        recognitionRef.current.abort();
      } catch {
        // Ignore stop on inactive instance
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    if (wasActive && soundFeedback) {
      playMicStopSound();
    }
  }, [isListening, soundFeedback]);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      const errMsg = 'Voice input not supported in this browser';
      setError(errMsg);
      onErrorRef.current?.(errMsg);
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    isUserActiveRef.current = true;
    pendingInterimRef.current = '';
    lastFinalIndexRef.current = -1;
    lastCommittedTextRef.current = '';
    lastCommittedTimeRef.current = 0;
    errorCountRef.current = 0;

    // Pre-flight microphone permission check
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        isUserActiveRef.current = false;
        setIsListening(false);
        const errType =
          err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
            ? 'not-allowed'
            : err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError'
              ? 'audio-capture'
              : 'not-allowed';
        setError(errType);
        onErrorRef.current?.(errType);
        return;
      }
    }

    if (!isUserActiveRef.current) return;

    const spawnRecognition = () => {
      if (!isUserActiveRef.current) return;

      try {
        const SpeechRecognition =
          window.SpeechRecognition || window.webkitSpeechRecognition;

        const recognition = new SpeechRecognition();
        recognition.continuous = continuous;
        recognition.interimResults = true;
        recognition.lang = lang;

        recognition.onstart = () => {
          setIsListening(true);
          setError(null);
          errorCountRef.current = 0;
          if (soundFeedback) {
            playMicStartSound();
          }
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

          const now = Date.now();
          if (now - lastErrorTimeRef.current < 2500) {
            errorCountRef.current += 1;
          } else {
            errorCountRef.current = 1;
          }
          lastErrorTimeRef.current = now;

          const errMsg = event.error || 'Speech recognition error';
          setError(errMsg);
          onErrorRef.current?.(errMsg);

          if (isUserActiveRef.current && soundFeedback) {
            playMicStopSound();
          }
          isUserActiveRef.current = false;
          setIsListening(false);
          recognitionRef.current = null;
        };

        recognition.onend = () => {
          // If user is still dictating and no repeated errors occurred, auto-restart with a fresh instance
          if (isUserActiveRef.current && errorCountRef.current < 2) {
            try {
              lastFinalIndexRef.current = -1;
              pendingInterimRef.current = '';
              spawnRecognitionRef.current?.();
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
          recognitionRef.current = null;
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        const errMsg = err?.message || 'Failed to start speech recognition';
        setError(errMsg);
        onErrorRef.current?.(errMsg);
        isUserActiveRef.current = false;
        setIsListening(false);
        recognitionRef.current = null;
      }
    };

    spawnRecognitionRef.current = spawnRecognition;
    spawnRecognition();
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

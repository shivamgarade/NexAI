import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSpeechRecognition } from './useSpeechRecognition';

vi.mock('@/lib/utils/audioFeedback', () => ({
  playMicStartSound: vi.fn(),
  playMicStopSound: vi.fn(),
  playTextAddedSound: vi.fn(),
}));

import { playMicStartSound, playMicStopSound } from '@/lib/utils/audioFeedback';

describe('useSpeechRecognition Hook', () => {
  let mockRecognition;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRecognition = {
      continuous: false,
      interimResults: false,
      lang: '',
      start: vi.fn(function () {
        this.onstart?.();
      }),
      stop: vi.fn(function () {
        this.onend?.();
      }),
      abort: vi.fn(function () {
        this.onend?.();
      }),
      onstart: null,
      onresult: null,
      onerror: null,
      onend: null,
    };

    window.SpeechRecognition = vi.fn(() => mockRecognition);
  });

  afterEach(() => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
  });

  it('detects browser support correctly', () => {
    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.isSupported).toBe(true);
  });

  it('starts listening and plays start sound only when onstart fires', async () => {
    const { result } = renderHook(() => useSpeechRecognition({ soundFeedback: true }));

    await act(async () => {
      await result.current.startListening();
    });

    expect(result.current.isListening).toBe(true);
    expect(playMicStartSound).toHaveBeenCalledTimes(1);
  });

  it('stops listening and plays stop sound', async () => {
    const { result } = renderHook(() => useSpeechRecognition({ soundFeedback: true }));

    await act(async () => {
      await result.current.startListening();
    });

    await act(async () => {
      result.current.stopListening();
    });

    expect(result.current.isListening).toBe(false);
    expect(playMicStopSound).toHaveBeenCalledTimes(1);
  });

  it('calls onError callback on speech recognition errors and does not loop', async () => {
    const onErrorMock = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ onError: onErrorMock, soundFeedback: true })
    );

    await act(async () => {
      await result.current.startListening();
    });

    // Simulate recognition error
    act(() => {
      mockRecognition.onerror?.({ error: 'not-allowed' });
    });

    expect(onErrorMock).toHaveBeenCalledWith('not-allowed');
    expect(result.current.isListening).toBe(false);
  });
});


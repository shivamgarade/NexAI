import { useAuthStore } from '@/store/authStore';

/**
 * Unwraps potentially nested or stringified JSON errors into human-readable text.
 *
 * @param {any} raw
 * @returns {string}
 */
export function sanitizeErrorMessage(raw) {
  if (!raw) return 'An error occurred';
  if (typeof raw !== 'string') {
    if (typeof raw === 'object' && raw.message) return sanitizeErrorMessage(raw.message);
    return String(raw);
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      let parsed = JSON.parse(trimmed);
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
            return parsed.message;
          }
        }
        if (parsed.message) return String(parsed.message);
        if (parsed.error && typeof parsed.error === 'string') return parsed.error;
        break;
      }
    } catch {
      // not valid JSON, return as is
    }
  }

  return raw;
}

/**
 * Parses an SSE text chunk or stream into structured events.
 *
 * @param {ReadableStream<Uint8Array>} readableStream
 * @param {Object} handlers
 * @param {(text: string) => void} [handlers.onThought]
 * @param {(text: string) => void} [handlers.onToken]
 * @param {(doneData: { messageId?: string, tokensUsed?: number, creditsDeducted?: number, creditsRemaining?: number, chatTitle?: string }) => void} [handlers.onDone]
 * @param {(errorData: { code?: string, message?: string }) => void} [handlers.onError]
 * @returns {Promise<void>}
 */
export async function parseSseStream(
  readableStream,
  { onThought, onToken, onStep, onGrounding, onMemoryUpdated, onDone, onError } = {},
) {
  const reader = readableStream.getReader();
  const decoder = new TextDecoder('utf-8');

  let buffer = '';
  let currentEvent = 'message';
  let currentData = '';

  const dispatchEvent = () => {
    if (!currentData && currentEvent === 'message') {
      return;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(currentData);
    } catch {
      parsed = currentData;
    }

    if (currentEvent === 'thought') {
      const text =
        typeof parsed === 'object' && parsed !== null && 'text' in parsed ? parsed.text : parsed;
      onThought?.(text);
    } else if (currentEvent === 'token') {
      const text =
        typeof parsed === 'object' && parsed !== null && 'text' in parsed ? parsed.text : parsed;
      onToken?.(text);
    } else if (currentEvent === 'step') {
      onStep?.(parsed);
    } else if (currentEvent === 'grounding') {
      onGrounding?.(parsed);
    } else if (currentEvent === 'memory_updated') {
      onMemoryUpdated?.(parsed);
    } else if (currentEvent === 'done') {
      onDone?.(typeof parsed === 'object' && parsed !== null ? parsed : { raw: parsed });
    } else if (currentEvent === 'error') {
      const errObj = typeof parsed === 'object' && parsed !== null ? parsed : { message: parsed };
      if (errObj.message) {
        errObj.message = sanitizeErrorMessage(errObj.message);
      }
      onError?.(errObj);
    }

    currentEvent = 'message';
    currentData = '';
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Split buffer by newlines (handling \r\n, \r, and \n)
      const lines = buffer.split(/\r\n|\r|\n/);
      // The last element is either empty (if ended with newline) or incomplete line
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trimStart();

        if (line === '') {
          // Empty line indicates the end of an event
          dispatchEvent();
        } else if (line.startsWith(':')) {
          // SSE comment; ignore
          continue;
        } else if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const dataContent = line.slice(5).trim();
          currentData = currentData ? `${currentData}\n${dataContent}` : dataContent;
        }
      }
    }

    // Flush any remaining line and event
    if (buffer.trim()) {
      const line = buffer.trimStart();
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        const dataContent = line.slice(5).trim();
        currentData = currentData ? `${currentData}\n${dataContent}` : dataContent;
      }
    }
    dispatchEvent();
  } finally {
    reader.releaseLock();
  }
}

/**
 * Initiates an authenticated SSE stream for sending a message in a chat.
 *
 * @param {Object} params
 * @param {string} params.chatId
 * @param {string} params.content
 * @param {string} [params.model]
 * @param {AbortSignal} [params.signal]
 * @param {string} [params.thinkingLevel='off']
 * @param {boolean} [params.isSimulation=false]
 * @param {AbortSignal} [params.signal]
 * @param {(text: string) => void} [params.onThought]
 * @param {(text: string) => void} [params.onToken]
 * @param {(doneData: any) => void} [params.onDone]
 * @param {(errorData: any) => void} [params.onError]
 * @returns {Promise<void>}
 */
export async function streamChatMessage({
  chatId,
  content,
  model,
  thinkingLevel = 'off',
  attachments = [],
  isSimulation = false,
  skillId = null,
  enabledTools = [],
  signal,
  onThought,
  onToken,
  onStep,
  onGrounding,
  onMemoryUpdated,
  onDone,
  onError,
}) {
  const token = useAuthStore.getState().accessToken;
  const baseUrl = import.meta.env.VITE_API_URL || '/api';
  const url = `${baseUrl}/chats/${chatId}/messages`;

  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const safeAttachments = Array.isArray(attachments) ? attachments : [];

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content,
      model,
      thinkingLevel,
      isSimulation,
      attachments: safeAttachments,
      ...(skillId ? { skillId } : {}),
      ...(enabledTools?.length ? { enabledTools } : {}),
    }),
    signal,
    credentials: 'include',
  });

  if (response.status === 402) {
    let errorJson = null;
    try {
      errorJson = await response.json();
    } catch {
      // Ignore json parse error
    }
    const err = {
      status: 402,
      code: errorJson?.error?.code || 'INSUFFICIENT_CREDITS',
      message: sanitizeErrorMessage(errorJson?.error?.message || 'Recharge to continue'),
      details: errorJson?.error?.details || null,
    };
    onError?.(err);
    throw err;
  }

  if (!response.ok) {
    let errorJson = null;
    try {
      errorJson = await response.json();
    } catch {
      // Ignore json parse error
    }
    const detailMsg = Array.isArray(errorJson?.error?.details)
      ? errorJson.error.details.map((d) => (d.path ? `${d.path}: ${d.message}` : d.message)).join(', ')
      : null;
    const rawMsg = detailMsg
      ? `${errorJson?.error?.message || 'Validation error'} (${detailMsg})`
      : errorJson?.error?.message || response.statusText || 'Failed to stream message';

    const err = {
      status: response.status,
      code: errorJson?.error?.code || 'STREAM_ERROR',
      message: sanitizeErrorMessage(rawMsg),
      details: errorJson?.error?.details || null,
    };
    onError?.(err);
    throw err;
  }

  if (!response.body) {
    const err = {
      status: 500,
      code: 'EMPTY_RESPONSE_BODY',
      message: 'Server returned an empty response body',
    };
    onError?.(err);
    throw err;
  }

  await parseSseStream(response.body, { onThought, onToken, onStep, onGrounding, onMemoryUpdated, onDone, onError });
}

/**
 * Initiates an authenticated SSE stream for sending a candidate response in an interview.
 *
 * @param {Object} params
 * @param {string} params.interviewId
 * @param {string} params.content
 * @param {string} [params.model]
 * @param {boolean} [params.isSimulation]
 * @param {AbortSignal} [params.signal]
 * @param {(text: string) => void} [params.onToken]
 * @param {(doneData: any) => void} [params.onDone]
 * @param {(errorData: any) => void} [params.onError]
 * @returns {Promise<void>}
 */
export async function streamInterviewResponse({
  interviewId,
  content,
  model,
  isSimulation = false,
  signal,
  onToken,
  onDone,
  onError,
}) {
  const token = useAuthStore.getState().accessToken;
  const baseUrl = import.meta.env.VITE_API_URL || '/api';
  const url = `${baseUrl}/interview/${interviewId}/respond`;

  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content, model, isSimulation }),
    signal,
    credentials: 'include',
  });

  if (response.status === 402) {
    let errorJson = null;
    try {
      errorJson = await response.json();
    } catch {
      // Ignore json parse error
    }
    const err = {
      status: 402,
      code: errorJson?.error?.code || 'INSUFFICIENT_CREDITS',
      message: sanitizeErrorMessage(errorJson?.error?.message || 'Recharge to continue'),
      details: errorJson?.error?.details || null,
    };
    onError?.(err);
    throw err;
  }

  if (!response.ok) {
    let errorJson = null;
    try {
      errorJson = await response.json();
    } catch {
      // Ignore json parse error
    }
    const rawMsg = errorJson?.error?.message || response.statusText || 'Failed to stream interview response';
    const err = {
      status: response.status,
      code: errorJson?.error?.code || 'STREAM_ERROR',
      message: sanitizeErrorMessage(rawMsg),
      details: errorJson?.error?.details || null,
    };
    onError?.(err);
    throw err;
  }

  if (!response.body) {
    const err = {
      status: 500,
      code: 'EMPTY_RESPONSE_BODY',
      message: 'Server returned an empty response body',
    };
    onError?.(err);
    throw err;
  }

  await parseSseStream(response.body, { onToken, onDone, onError });
}


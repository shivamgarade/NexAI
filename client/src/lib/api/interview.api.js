import { apiClient } from './client.js';

export const interviewApi = {
  /**
   * Start a new mock interview session
   * @param {{ role: string, difficulty: 'junior' | 'mid' | 'senior', topic: string, model?: 'flash' | 'pro', isSimulation?: boolean }} data
   */
  startInterview(data) {
    return apiClient.post('/interview/start', data);
  },

  /**
   * Conclude an interview session, generate scorecard, and auto-archive to library
   * @param {string} id
   * @param {{ model?: 'flash' | 'pro' }} [data]
   */
  concludeInterview(id, data = {}) {
    return apiClient.post(`/interview/${id}/conclude`, data);
  },

  /**
   * List all interview sessions for authenticated user
   */
  getInterviews() {
    return apiClient.get('/interview');
  },

  /**
   * Retrieve single interview session by ID
   * @param {string} id
   */
  getInterviewById(id) {
    return apiClient.get(`/interview/${id}`);
  },

  /**
   * Synthesize interview speech via Edge Neural TTS or Gemini 3.8 Flash-Lite TTS
   * Returns audio Blob (MP3/WAV) with headers: X-Engine, X-Credits-Remaining, X-Tokens-Used
   * @param {{ text: string, engine?: 'edge' | 'gemini', voice?: string, style?: string, isSimulation?: boolean, sessionId?: string }} data
   */
  synthesizeSpeech(data) {
    return apiClient.post('/interview/tts', data, {
      responseType: 'blob',
    });
  },
};


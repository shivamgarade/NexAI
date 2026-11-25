import { apiClient } from './client.js';

export const storageApi = {
  /**
   * Uploads a file (base64 string or data URL) to the configured storage provider (ImageKit, Cloudinary, or Local).
   * @param {{ file: string, fileName: string, mimeType?: string, source?: string }} payload
   */
  upload(payload) {
    return apiClient.post('/storage/upload', payload);
  },

  /**
   * Lists the user's uploaded files.
   * @param {{ limit?: number, skip?: number }} [params]
   */
  listFiles(params = {}) {
    return apiClient.get('/storage/files', { params });
  },

  /**
   * Checks the active storage provider configuration.
   */
  getStatus() {
    return apiClient.get('/storage/status');
  },
};

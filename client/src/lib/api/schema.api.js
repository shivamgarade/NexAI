import { apiClient } from './client.js';

export const schemaApi = {
  /**
   * Generates a database schema, ERD diagram, and multi-dialect code models.
   * @param {{ prompt: string, dialects?: string[], existingSchema?: string, model?: 'flash' | 'pro', isSimulation?: boolean }} data
   */
  generateSchema(data) {
    return apiClient.post('/schemas/generate', data);
  },
};

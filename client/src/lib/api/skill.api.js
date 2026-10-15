import { apiClient } from './client.js';

export const skillApi = {
  /**
   * Fetch skills for current user with optional filters (category, tool, search, isFavorite).
   * @param {{ category?: string, tool?: string, search?: string, isFavorite?: boolean, isSystem?: boolean }} [params]
   */
  getSkills(params) {
    return apiClient.get('/skills', { params });
  },

  /**
   * Retrieve a specific skill by ID.
   * @param {string} id
   */
  getSkill(id) {
    return apiClient.get(`/skills/${id}`);
  },

  /**
   * Create a new custom skill.
   * @param {{ title: string, description?: string, icon?: string, instructions: string, tools?: string[], category?: string, tags?: string[], isFavorite?: boolean }} data
   */
  createSkill(data) {
    return apiClient.post('/skills', data);
  },

  /**
   * Update an existing skill.
   * @param {string} id
   * @param {Record<string, any>} data
   */
  updateSkill(id, data) {
    return apiClient.patch(`/skills/${id}`, data);
  },

  /**
   * Delete a skill.
   * @param {string} id
   */
  deleteSkill(id) {
    return apiClient.delete(`/skills/${id}`);
  },

  /**
   * Toggle favorite status on a skill.
   * @param {string} id
   */
  toggleFavorite(id) {
    return apiClient.post(`/skills/${id}/favorite`);
  },
};

import { apiClient } from './client.js';

export const connectedAppApi = {
  getApps() {
    return apiClient.get('/connected-apps');
  },

  updateApp(slug, data) {
    return apiClient.patch(`/connected-apps/${slug}`, data);
  },
};

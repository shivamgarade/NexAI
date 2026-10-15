import { apiClient } from './client.js';

export const scheduleApi = {
  getSchedules() {
    return apiClient.get('/schedules');
  },

  getSchedule(id) {
    return apiClient.get(`/schedules/${id}`);
  },

  createSchedule(data) {
    return apiClient.post('/schedules', data);
  },

  updateSchedule(id, data) {
    return apiClient.patch(`/schedules/${id}`, data);
  },

  deleteSchedule(id) {
    return apiClient.delete(`/schedules/${id}`);
  },

  toggleSchedule(id) {
    return apiClient.patch(`/schedules/${id}/toggle`);
  },

  runScheduleNow(id) {
    return apiClient.post(`/schedules/${id}/run-now`);
  },
};

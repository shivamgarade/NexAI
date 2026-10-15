import { create } from 'zustand';
import { scheduleApi } from '@/lib/api/schedule.api.js';
import { useChatStore } from './chatStore.js';
import { toast } from './uiStore.js';

export const useScheduleStore = create((set) => ({
  schedules: [],
  isLoading: false,
  isSaving: false,
  runningScheduleIds: [],
  error: null,

  fetchSchedules: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await scheduleApi.getSchedules();
      const schedules = res.data || [];
      set({ schedules, isLoading: false });
      return schedules;
    } catch (err) {
      const message = err.message || 'Failed to load schedules';
      set({ isLoading: false, error: message });
      toast.error(message);
      return [];
    }
  },

  createSchedule: async (data) => {
    set({ isSaving: true });
    try {
      const res = await scheduleApi.createSchedule(data);
      const newSchedule = res.data;
      set((state) => ({
        schedules: [newSchedule, ...state.schedules],
        isSaving: false,
      }));
      toast.success(`Schedule "${newSchedule.title}" created successfully`);
      return newSchedule;
    } catch (err) {
      const message = err.message || 'Failed to create schedule';
      set({ isSaving: false });
      toast.error(message);
      throw err;
    }
  },

  updateSchedule: async (id, data) => {
    set({ isSaving: true });
    try {
      const res = await scheduleApi.updateSchedule(id, data);
      const updated = res.data;
      set((state) => ({
        schedules: state.schedules.map((s) => (s._id === id ? updated : s)),
        isSaving: false,
      }));
      toast.success('Schedule updated');
      return updated;
    } catch (err) {
      const message = err.message || 'Failed to update schedule';
      set({ isSaving: false });
      toast.error(message);
      throw err;
    }
  },

  deleteSchedule: async (id) => {
    try {
      await scheduleApi.deleteSchedule(id);
      set((state) => ({
        schedules: state.schedules.filter((s) => s._id !== id),
      }));
      toast.success('Schedule deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete schedule');
      throw err;
    }
  },

  toggleSchedule: async (id) => {
    try {
      const res = await scheduleApi.toggleSchedule(id);
      const updated = res.data;
      set((state) => ({
        schedules: state.schedules.map((s) => (s._id === id ? updated : s)),
      }));
      toast.success(updated.isActive ? 'Schedule activated' : 'Schedule paused');
      return updated;
    } catch (err) {
      toast.error(err.message || 'Failed to toggle schedule');
      throw err;
    }
  },

  runScheduleNow: async (id) => {
    set((state) => ({
      runningScheduleIds: [...state.runningScheduleIds, id],
    }));
    toast.info('Executing automated schedule...');
    try {
      const res = await scheduleApi.runScheduleNow(id);
      const executionData = res.data;
      set((state) => ({
        schedules: state.schedules.map((s) =>
          s._id === id ? executionData.schedule || s : s,
        ),
        runningScheduleIds: state.runningScheduleIds.filter((item) => item !== id),
      }));

      // Immediately add the new chat to Recents in the sidebar
      if (executionData.chat) {
        useChatStore.setState((state) => ({
          chats: [
            executionData.chat,
            ...state.chats.filter((c) => c._id !== executionData.chat._id),
          ],
        }));
      } else {
        useChatStore.getState().fetchChats();
      }

      toast.success('Schedule executed! Chat added to recents.');
      return executionData;
    } catch (err) {
      set((state) => ({
        runningScheduleIds: state.runningScheduleIds.filter((item) => item !== id),
      }));
      toast.error(err.message || 'Execution failed');
      throw err;
    }
  },
}));

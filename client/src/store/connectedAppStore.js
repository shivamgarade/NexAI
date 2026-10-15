import { create } from 'zustand';
import { connectedAppApi } from '@/lib/api/connectedApp.api.js';
import { toast } from './uiStore.js';

export const useConnectedAppStore = create((set) => ({
  apps: [],
  isLoading: false,
  isSaving: false,
  error: null,

  fetchConnectedApps: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await connectedAppApi.getApps();
      const apps = res.data || [];
      set({ apps, isLoading: false });
      return apps;
    } catch (err) {
      const message = err.message || 'Failed to load connected apps';
      set({ isLoading: false, error: message });
      toast.error(message);
      return [];
    }
  },

  updateApp: async (slug, data) => {
    set({ isSaving: true });
    try {
      const res = await connectedAppApi.updateApp(slug, data);
      const updated = res.data;
      set((state) => ({
        apps: state.apps.map((a) => (a.appSlug === slug ? updated : a)),
        isSaving: false,
      }));
      toast.success(`${updated.name} integration updated`);
      return updated;
    } catch (err) {
      set({ isSaving: false });
      toast.error(err.message || 'Failed to update app integration');
      throw err;
    }
  },

  toggleConnection: async (slug, isConnected) => {
    try {
      const res = await connectedAppApi.updateApp(slug, { isConnected });
      const updated = res.data;
      set((state) => ({
        apps: state.apps.map((a) => (a.appSlug === slug ? updated : a)),
      }));
      toast.success(
        updated.isConnected
          ? `${updated.name} connected`
          : `${updated.name} disconnected`,
      );
      return updated;
    } catch (err) {
      toast.error(err.message || 'Failed to toggle connection');
      throw err;
    }
  },
}));

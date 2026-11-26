import { create } from 'zustand';

const initialTheme =
  typeof window !== 'undefined' ? localStorage.getItem('nexai_theme') || 'dark' : 'dark';

const initialSidebarCollapsed =
  typeof window !== 'undefined'
    ? localStorage.getItem('nexai_sidebar_collapsed') === 'true'
    : false;

export const useUiStore = create((set, get) => ({
  theme: initialTheme,
  isDrawerOpen: false,
  isSidebarCollapsed: initialSidebarCollapsed,
  toasts: [],
  isSettingsModalOpen: false,
  settingsModalTab: 'general',

  openSettingsModal: (tab = 'general') => set({ isSettingsModalOpen: true, settingsModalTab: tab }),
  closeSettingsModal: () => set({ isSettingsModalOpen: false }),

  setSidebarCollapsed: (isSidebarCollapsed) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nexai_sidebar_collapsed', String(isSidebarCollapsed));
    }
    set({ isSidebarCollapsed });
  },

  toggleSidebarCollapsed: () => {
    const next = !get().isSidebarCollapsed;
    get().setSidebarCollapsed(next);
  },

  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nexai_theme', theme);
      const effectiveTheme =
        theme === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : theme;
      document.documentElement.dataset.theme = effectiveTheme;
    }
    set({ theme });
  },

  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(nextTheme);
  },

  setDrawerOpen: (isDrawerOpen) => set({ isDrawerOpen }),

  addToast: ({ message, tone = 'info', duration = 4000 }) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    set((state) => ({
      toasts: [...state.toasts, { id, message, tone }],
    }));

    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

export const toast = {
  success: (message, duration) =>
    useUiStore.getState().addToast({ message, tone: 'success', duration }),
  error: (message, duration) =>
    useUiStore.getState().addToast({ message, tone: 'error', duration }),
  info: (message, duration) => useUiStore.getState().addToast({ message, tone: 'info', duration }),
};

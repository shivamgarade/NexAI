import { create } from 'zustand';
import { adminApi } from '@/lib/api/admin.api.js';

export const useAdminStore = create((set, get) => ({
  stats: null,
  usageData: null,
  systemConfig: null,
  telemetry: null,
  isUpdatingConfig: false,
  range: '7d',
  transactions: {
    list: [],
    total: 0,
    page: 1,
    totalPages: 1,
  },
  errors: {
    list: [],
    total: 0,
    page: 1,
    totalPages: 1,
  },
  isLoading: false,
  isLoadingTransactions: false,
  isLoadingErrors: false,
  error: null,

  setRange: (range) => {
    set({ range });
    get().fetchUsage(range);
  },

  fetchOverview: async () => {
    set({ isLoading: true, error: null });
    try {
      const currentRange = get().range;
      const promises = [
        adminApi.getStats(),
        adminApi.getUsage({ range: currentRange }),
      ];

      if (typeof adminApi.getConfig === 'function') {
        promises.push(adminApi.getConfig().catch(() => null));
      }

      const [statsRes, usageRes, configRes] = await Promise.all(promises);

      const updates = {
        stats: statsRes.data?.data || statsRes.data,
        usageData: usageRes.data?.data || usageRes.data,
        isLoading: false,
      };

      const configPayload = configRes?.data?.data || configRes?.data || configRes || {};
      if (configPayload.config || configPayload.telemetry) {
        updates.systemConfig = configPayload.config || null;
        updates.telemetry = configPayload.telemetry || null;
      }

      set(updates);
    } catch (err) {
      set({
        error: err.response?.data?.error?.message || err.message || 'Failed to load admin overview',
        isLoading: false,
      });
    }
  },

  fetchConfig: async () => {
    try {
      const res = await adminApi.getConfig();
      const payload = res.data?.data || res.data || {};
      set({
        systemConfig: payload.config || null,
        telemetry: payload.telemetry || null,
      });
      return payload;
    } catch (err) {
      set({
        error: err.response?.data?.error?.message || err.message,
      });
      return null;
    }
  },

  updateBillingMode: async (mode) => {
    set({ isUpdatingConfig: true });
    try {
      const res = await adminApi.updateConfig({ billingEnforcementMode: mode });
      const payload = res.data?.data || res.data || {};
      set({
        systemConfig: payload.config || null,
        telemetry: payload.telemetry || get().telemetry,
        isUpdatingConfig: false,
      });
      return payload;
    } catch (err) {
      set({
        isUpdatingConfig: false,
        error: err.response?.data?.error?.message || 'Failed to update governance mode',
      });
      throw err;
    }
  },

  fetchUsage: async (rangeOverride) => {
    const range = rangeOverride || get().range;
    try {
      const res = await adminApi.getUsage({ range });
      set({
        usageData: res.data?.data || res.data,
      });
    } catch (err) {
      set({
        error: err.response?.data?.error?.message || err.message,
      });
    }
  },

  fetchTransactions: async (page = 1) => {
    set({ isLoadingTransactions: true });
    try {
      const res = await adminApi.getTransactions({ page, limit: 10 });
      const payload = res.data?.data || res.data || {};
      set({
        transactions: {
          list: payload.transactions || [],
          total: payload.total || 0,
          page: payload.page || page,
          totalPages: payload.totalPages || 1,
        },
        isLoadingTransactions: false,
      });
    } catch {
      set({ isLoadingTransactions: false });
    }
  },

  fetchErrors: async (page = 1) => {
    set({ isLoadingErrors: true });
    try {
      const res = await adminApi.getErrors({ page, limit: 10 });
      const payload = res.data?.data || res.data || {};
      set({
        errors: {
          list: payload.errors || [],
          total: payload.total || 0,
          page: payload.page || page,
          totalPages: payload.totalPages || 1,
        },
        isLoadingErrors: false,
      });
    } catch {
      set({ isLoadingErrors: false });
    }
  },
}));

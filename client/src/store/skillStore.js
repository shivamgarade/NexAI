import { create } from 'zustand';
import { skillApi } from '@/lib/api/skill.api.js';
import { toast } from './uiStore.js';

export const useSkillStore = create((set, get) => ({
  skills: [],
  activeSkill: null, // Skill attached to current active chat session or turn
  selectedSkill: null, // Skill open in detail or edit modal
  isLoading: false,
  isSaving: false,
  error: null,
  activeCategory: 'All',
  activeTool: null,
  searchQuery: '',
  favoriteOnly: false,

  /**
   * Fetch all skills (system + user custom) with optional filters
   */
  fetchSkills: async (customFilters = {}) => {
    set({ isLoading: true, error: null });
    try {
      const { activeCategory, activeTool, searchQuery, favoriteOnly } = get();
      const params = {
        ...(activeCategory && activeCategory !== 'All' ? { category: activeCategory } : {}),
        ...(activeTool ? { tool: activeTool } : {}),
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(favoriteOnly ? { isFavorite: true } : {}),
        ...customFilters,
      };

      const res = await skillApi.getSkills(params);
      const skills = res.data || [];
      set({ skills, isLoading: false });
      return skills;
    } catch (err) {
      const message = err.message || 'Failed to load skills';
      set({ isLoading: false, error: message });
      toast.error(message);
      return [];
    }
  },

  /**
   * Create a new custom agent skill
   */
  createSkill: async (data) => {
    set({ isSaving: true });
    try {
      const res = await skillApi.createSkill(data);
      const newSkill = res.data;
      set((state) => ({
        skills: [newSkill, ...state.skills],
        isSaving: false,
      }));
      toast.success(`Skill "${newSkill.title}" created successfully`);
      return newSkill;
    } catch (err) {
      const message = err.message || 'Failed to create skill';
      set({ isSaving: false });
      toast.error(message);
      return null;
    }
  },

  /**
   * Update an existing custom skill
   */
  updateSkill: async (id, data) => {
    set({ isSaving: true });
    try {
      const res = await skillApi.updateSkill(id, data);
      const updated = res.data;
      set((state) => ({
        skills: state.skills.map((s) => (s._id === id ? { ...s, ...updated } : s)),
        selectedSkill:
          state.selectedSkill?._id === id
            ? { ...state.selectedSkill, ...updated }
            : state.selectedSkill,
        activeSkill:
          state.activeSkill?._id === id ? { ...state.activeSkill, ...updated } : state.activeSkill,
        isSaving: false,
      }));
      toast.success('Skill updated');
      return updated;
    } catch (err) {
      const message = err.message || 'Failed to update skill';
      set({ isSaving: false });
      toast.error(message);
      return null;
    }
  },

  /**
   * Toggle favorite state for a skill
   */
  toggleFavorite: async (id) => {
    const skill = get().skills.find((s) => s._id === id);
    if (!skill) return null;

    const newFav = !skill.isFavorite;
    // Optimistic update
    set((state) => ({
      skills: state.skills.map((s) => (s._id === id ? { ...s, isFavorite: newFav } : s)),
    }));

    try {
      const res = await skillApi.toggleFavorite(id);
      const updated = res.data;
      set((state) => ({
        skills: state.skills.map((s) => (s._id === id ? { ...s, ...updated } : s)),
      }));
      return updated;
    } catch (err) {
      // Revert on error
      set((state) => ({
        skills: state.skills.map((s) =>
          s._id === id ? { ...s, isFavorite: skill.isFavorite } : s,
        ),
      }));
      const message = err.message || 'Failed to toggle favorite';
      toast.error(message);
      return null;
    }
  },

  /**
   * Delete a custom skill
   */
  deleteSkill: async (id) => {
    try {
      await skillApi.deleteSkill(id);
      set((state) => ({
        skills: state.skills.filter((s) => s._id !== id),
        selectedSkill: state.selectedSkill?._id === id ? null : state.selectedSkill,
        activeSkill: state.activeSkill?._id === id ? null : state.activeSkill,
      }));
      toast.success('Skill deleted');
      return true;
    } catch (err) {
      const message = err.message || 'Failed to delete skill';
      toast.error(message);
      return false;
    }
  },

  setActiveSkill: (skill) => set({ activeSkill: skill }),
  clearActiveSkill: () => set({ activeSkill: null }),
  setSelectedSkill: (skill) => set({ selectedSkill: skill }),

  setActiveCategory: (category) => {
    set({ activeCategory: category });
    get().fetchSkills();
  },

  setActiveTool: (tool) => {
    set({ activeTool: tool });
    get().fetchSkills();
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  setFavoriteOnly: (favoriteOnly) => {
    set({ favoriteOnly });
    get().fetchSkills();
  },
}));

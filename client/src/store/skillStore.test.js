import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSkillStore } from './skillStore';
import { skillApi } from '@/lib/api/skill.api';

vi.mock('@/lib/api/skill.api', () => ({
  skillApi: {
    getSkills: vi.fn(),
    getSkill: vi.fn(),
    createSkill: vi.fn(),
    updateSkill: vi.fn(),
    deleteSkill: vi.fn(),
    toggleFavorite: vi.fn(),
  },
}));

describe('skillStore Zustand Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSkillStore.setState({
      skills: [],
      selectedSkill: null,
      activeSkill: null,
      isLoading: false,
      isSaving: false,
      error: null,
      activeCategory: 'all',
      searchQuery: '',
      favoriteOnly: false,
    });
  });

  it('fetchSkills populates skills list', async () => {
    const mockSkills = [
      {
        _id: 'sk1',
        title: 'Web Deep Researcher',
        tools: ['web_search', 'fetch_url'],
        isSystem: true,
      },
      {
        _id: 'sk2',
        title: 'Custom Analyst',
        tools: ['workspace_search'],
        isSystem: false,
      },
    ];
    skillApi.getSkills.mockResolvedValueOnce({ data: mockSkills });

    const result = await useSkillStore.getState().fetchSkills();

    expect(result).toHaveLength(2);
    expect(useSkillStore.getState().skills).toEqual(mockSkills);
    expect(useSkillStore.getState().isLoading).toBe(false);
  });

  it('setActiveSkill and clearActiveSkill update state', () => {
    const skill = { _id: 'sk1', title: 'Web Researcher', tools: ['web_search'] };
    useSkillStore.getState().setActiveSkill(skill);
    expect(useSkillStore.getState().activeSkill).toEqual(skill);

    useSkillStore.getState().clearActiveSkill();
    expect(useSkillStore.getState().activeSkill).toBeNull();
  });

  it('createSkill adds new skill to state', async () => {
    const newSkill = {
      _id: 'sk3',
      title: 'Python Runner',
      tools: ['code_execution'],
      instructions: 'Run python scripts securely',
    };
    skillApi.createSkill.mockResolvedValueOnce({ data: newSkill });

    const result = await useSkillStore.getState().createSkill({
      title: 'Python Runner',
      tools: ['code_execution'],
      instructions: 'Run python scripts securely',
    });

    expect(result).toEqual(newSkill);
    expect(useSkillStore.getState().skills[0]).toEqual(newSkill);
  });
});

import React, { createRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SlashSkillsPopover } from './SlashSkillsPopover';
import { useSkillStore } from '@/store/skillStore';

describe('SlashSkillsPopover Component', () => {
  const mockSkills = [
    {
      _id: 'skill-1',
      title: 'Web Researcher',
      description: 'Browses and summarizes web sources',
      isSystem: true,
      tools: ['web_search'],
    },
    {
      _id: 'skill-2',
      title: 'Python Sandbox',
      description: 'Executes Python algorithms',
      isSystem: false,
      tools: ['code_execution'],
    },
  ];

  beforeEach(() => {
    useSkillStore.setState({
      skills: mockSkills,
      activeSkill: null,
      fetchSkills: vi.fn(),
    });
  });

  it('does not render when open is false', () => {
    render(
      <SlashSkillsPopover
        open={false}
        onClose={vi.fn()}
        onSelectSkill={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders root view with categories and keyboard hints when open', () => {
    render(
      <SlashSkillsPopover
        open={true}
        onClose={vi.fn()}
        onSelectSkill={vi.fn()}
      />
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('All Skills')).toBeTruthy();
    expect(screen.getByText('Built-in Agents')).toBeTruthy();
    expect(screen.getByText('My Custom Skills')).toBeTruthy();
    expect(screen.getByText('Favorites')).toBeTruthy();
    expect(screen.getByText(/Navigate/)).toBeTruthy();
  });

  it('supports keyboard navigation via ref handleKeyDown (ArrowDown, ArrowUp, Enter, ArrowLeft)', () => {
    const popoverRef = createRef();
    const handleSelect = vi.fn();

    render(
      <SlashSkillsPopover
        ref={popoverRef}
        open={true}
        onClose={vi.fn()}
        onSelectSkill={handleSelect}
      />
    );

    // Initial state: first item ('All Skills') highlighted
    const allSkillsBtn = screen.getByText('All Skills').closest('button');
    expect(allSkillsBtn.getAttribute('data-highlighted')).toBe('true');

    // ArrowDown -> highlights 'Built-in Agents'
    act(() => {
      popoverRef.current.handleKeyDown({ key: 'ArrowDown' });
    });
    const builtInBtn = screen.getByText('Built-in Agents').closest('button');
    expect(builtInBtn.getAttribute('data-highlighted')).toBe('true');

    // Enter -> opens 'Built-in Agents' category view
    act(() => {
      popoverRef.current.handleKeyDown({ key: 'Enter' });
    });
    expect(screen.getByText('Web Researcher')).toBeTruthy();

    // ArrowLeft -> goes back to root categories
    act(() => {
      popoverRef.current.handleKeyDown({ key: 'ArrowLeft' });
    });
    expect(screen.getByText('All Skills')).toBeTruthy();
  });

  it('selects highlighted skill on Enter in sub-view', () => {
    const popoverRef = createRef();
    const handleSelect = vi.fn();

    render(
      <SlashSkillsPopover
        ref={popoverRef}
        open={true}
        onClose={vi.fn()}
        onSelectSkill={handleSelect}
      />
    );

    // Click on 'All Skills'
    fireEvent.click(screen.getByText('All Skills'));
    expect(screen.getByText('Web Researcher')).toBeTruthy();

    // Press Enter to pick first skill
    act(() => {
      popoverRef.current.handleKeyDown({ key: 'Enter' });
    });
    expect(handleSelect).toHaveBeenCalledWith(mockSkills[0]);
  });

  it('closes on Escape key', () => {
    const popoverRef = createRef();
    const handleClose = vi.fn();

    render(
      <SlashSkillsPopover
        ref={popoverRef}
        open={true}
        onClose={handleClose}
        onSelectSkill={vi.fn()}
      />
    );

    act(() => {
      popoverRef.current.handleKeyDown({ key: 'Escape' });
    });
    expect(handleClose).toHaveBeenCalled();
  });
});

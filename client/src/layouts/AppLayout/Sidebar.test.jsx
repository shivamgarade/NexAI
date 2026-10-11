import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useUiStore } from '@/store/uiStore';
import { useProjectStore, DEFAULT_PROJECTS } from '@/store/projectStore';

describe('Sidebar Component', () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({
      isSidebarCollapsed: false,
    });
    useProjectStore.setState({
      projects: DEFAULT_PROJECTS,
      isLoading: false,
      fetchProjects: vi.fn().mockResolvedValue(DEFAULT_PROJECTS),
      createProject: vi.fn(),
      updateProject: vi.fn(),
      deleteProject: vi.fn(),
    });
    useAuthStore.setState({
      user: {
        email: 'developer@nexai.local',
        role: 'user',
        wallet: { creditsRemaining: 150, tier: 'free' },
      },
      isAuthenticated: true,
    });
    useChatStore.setState({
      chats: [
        { _id: 'chat-1', title: 'React Architecture Review', createdAt: new Date().toISOString() },
        { _id: 'chat-2', title: 'Python Web Scraping', createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
      ],
      activeChatId: 'chat-1',
      isLoadingChats: false,
      fetchChats: vi.fn(),
      selectChat: vi.fn(),
      updateChatTitle: vi.fn(),
      deleteChat: vi.fn(),
    });
  });

  it('renders expanded sidebar brand, single top search icon, primary navigation, projects, chats, and bottom settings', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    // Brand and single header search icon
    expect(screen.getByText('NexAI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search workspace/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /new chat/i }).length).toBeGreaterThanOrEqual(1);

    // Primary nav items
    expect(screen.getByRole('link', { name: /chat/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /library/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /skills/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /interview/i })).toBeInTheDocument();

    // ChatGPT-style "... More" section
    const moreBtn = screen.getByRole('button', { name: /toggle more navigation links/i });
    expect(moreBtn).toBeInTheDocument();
    // Expanding More reveals Wallet
    fireEvent.click(moreBtn);
    expect(screen.getByRole('menuitem', { name: /wallet/i })).toBeInTheDocument();

    // Non-admin user should NOT see Admin link even under More
    expect(screen.queryByRole('menuitem', { name: /admin/i })).not.toBeInTheDocument();

    // Projects Section
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('JS & WebStack')).toBeInTheDocument();

    // Chats Section with 3-dots filter button
    expect(screen.getByText('Chats')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter chats/i })).toBeInTheDocument();
    expect(screen.getByText('React Architecture Review')).toBeInTheDocument();
    expect(screen.getByText('Python Web Scraping')).toBeInTheDocument();

    // User profile and direct bottom Settings button on the right side
    expect(screen.getByText('developer')).toBeInTheDocument();
    expect(screen.getByText('Free Tier')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^settings$/i })).toBeInTheDocument();
  });

  it('renders Admin link under More when user has admin role', () => {
    useAuthStore.setState({
      user: {
        email: 'admin@nexai.local',
        role: 'admin',
        wallet: { creditsRemaining: 999, tier: 'pro_monthly' },
      },
      isAuthenticated: true,
    });

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    const moreBtn = screen.getByRole('button', { name: /toggle more navigation links/i });
    fireEvent.click(moreBtn);
    expect(screen.getByRole('menuitem', { name: /admin/i })).toBeInTheDocument();
  });

  it('toggles collapsible state smoothly', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    const toggleBtn = screen.getByRole('button', { name: /collapse sidebar/i });
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(useUiStore.getState().isSidebarCollapsed).toBe(true);

    // In collapsed state, "+ New chat" is an icon button
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument();
  });

  it('filters chat history using the three-dots filter menu', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    // Both chats are visible initially
    expect(screen.getByText('React Architecture Review')).toBeInTheDocument();
    expect(screen.getByText('Python Web Scraping')).toBeInTheDocument();

    // Click 3-dots filter button
    const filterBtn = screen.getByRole('button', { name: /filter chats/i });
    fireEvent.click(filterBtn);

    // Click 'Today' filter option
    const todayOption = screen.getByRole('menuitem', { name: /today/i });
    fireEvent.click(todayOption);

    // Today chat should remain, older chat should be filtered out
    expect(screen.getByText('React Architecture Review')).toBeInTheDocument();
    expect(screen.queryByText('Python Web Scraping')).not.toBeInTheDocument();
  });

  it('toggles projects and chats collapsible sections', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    // Projects can be collapsed
    const projectsToggle = screen.getByRole('button', { name: /toggle projects section/i });
    expect(screen.getByText('JS & WebStack')).toBeInTheDocument();
    fireEvent.click(projectsToggle);
    expect(screen.queryByText('JS & WebStack')).not.toBeInTheDocument();

    // Chats can be collapsed
    const chatsToggle = screen.getByRole('button', { name: /toggle chats section/i });
    expect(screen.getByText('React Architecture Review')).toBeInTheDocument();
    fireEvent.click(chatsToggle);
    expect(screen.queryByText('React Architecture Review')).not.toBeInTheDocument();
  });

  it('triggers onItemClick when rendered in mobile drawer', () => {
    const handleItemClick = vi.fn();

    render(
      <MemoryRouter>
        <Sidebar onItemClick={handleItemClick} isMobile />
      </MemoryRouter>,
    );

    // In mobile mode, collapse toggle is hidden
    expect(screen.queryByRole('button', { name: /collapse sidebar/i })).not.toBeInTheDocument();

    const libraryLink = screen.getByRole('link', { name: /library/i });
    fireEvent.click(libraryLink);

    expect(handleItemClick).toHaveBeenCalled();
  });

  it('renders collapsible Pinned and Recent sections and toggles their visibility', () => {
    // Pin chat-1
    localStorage.setItem('nexai_pinned_chats', JSON.stringify(['chat-1']));

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    // Both Pinned and Recent headers should be present
    const pinnedToggle = screen.getByRole('button', { name: /toggle pinned chats/i });
    const recentToggle = screen.getByRole('button', { name: /toggle recent chats/i });
    expect(pinnedToggle).toBeInTheDocument();
    expect(recentToggle).toBeInTheDocument();

    // Chat-1 (pinned) and Chat-2 (recent) are visible initially
    expect(screen.getByText('React Architecture Review')).toBeInTheDocument();
    expect(screen.getByText('Python Web Scraping')).toBeInTheDocument();

    // Collapse Pinned
    fireEvent.click(pinnedToggle);
    expect(screen.queryByText('React Architecture Review')).not.toBeInTheDocument();
    expect(screen.getByText('Python Web Scraping')).toBeInTheDocument();

    // Collapse Recent
    fireEvent.click(recentToggle);
    expect(screen.queryByText('React Architecture Review')).not.toBeInTheDocument();
    expect(screen.queryByText('Python Web Scraping')).not.toBeInTheDocument();

    // Uncollapse Pinned
    fireEvent.click(pinnedToggle);
    expect(screen.getByText('React Architecture Review')).toBeInTheDocument();
    expect(screen.queryByText('Python Web Scraping')).not.toBeInTheDocument();

    // Uncollapse Recent
    fireEvent.click(recentToggle);
    expect(screen.getByText('React Architecture Review')).toBeInTheDocument();
    expect(screen.getByText('Python Web Scraping')).toBeInTheDocument();
  });
});

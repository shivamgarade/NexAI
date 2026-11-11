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
    expect(screen.getByRole('link', { name: /prompt vault/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /interview/i })).toBeInTheDocument();

    // Merged Settings & Profile card opens settings modal directly
    const settingsBtn = screen.getByRole('button', { name: /settings and profile/i });
    expect(settingsBtn).toBeInTheDocument();
    fireEvent.click(settingsBtn);
    expect(useUiStore.getState().isSettingsModalOpen).toBe(true);
    expect(useUiStore.getState().settingsModalTab).toBe('profile');

    // Projects Section
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('JS & WebStack')).toBeInTheDocument();

    // Chats Section with 3-dots filter button
    expect(screen.getByText('Chats')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter chats/i })).toBeInTheDocument();
    expect(screen.getByText('React Architecture Review')).toBeInTheDocument();
    expect(screen.getByText('Python Web Scraping')).toBeInTheDocument();

    // User profile information rendered inside the merged Settings & Profile card
    expect(screen.getByText('developer')).toBeInTheDocument();
    expect(screen.getByText('Free Tier')).toBeInTheDocument();
  });

  it('opens settings modal directly when clicking settings button in collapsed footer', () => {
    useUiStore.setState({ isSidebarCollapsed: true, isSettingsModalOpen: false });
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    const settingsBtn = screen.getByRole('button', { name: /settings & profile/i });
    fireEvent.click(settingsBtn);
    expect(useUiStore.getState().isSettingsModalOpen).toBe(true);
    expect(useUiStore.getState().settingsModalTab).toBe('profile');
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

    // In collapsed state, New chat and expand sidebar toggle and Settings are present
    const expandBtn = screen.getByRole('button', { name: /expand sidebar/i });
    expect(expandBtn).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /new chat/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /^settings$/i })).toBeInTheDocument();

    // Clicking expand sidebar re-opens the sidebar
    fireEvent.click(expandBtn);
    expect(useUiStore.getState().isSidebarCollapsed).toBe(false);
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

  it('keeps the exact same nav items and data-tip tooltips in both open and collapsed states', () => {
    const { container } = render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    // Verify all primary items and more have data-tip
    expect(screen.getByRole('link', { name: /chat/i })).toHaveAttribute('data-tip', 'Chat');
    expect(screen.getByRole('link', { name: /library/i })).toHaveAttribute('data-tip', 'Library');
    expect(screen.getByRole('link', { name: /prompt vault/i })).toHaveAttribute('data-tip', 'Prompt Vault');
    expect(screen.getByRole('link', { name: /interview/i })).toHaveAttribute('data-tip', 'Interview');
    expect(screen.getByRole('button', { name: /toggle more navigation links/i })).toHaveAttribute('data-tip', 'More');

    // Toggle collapse
    const toggleBtn = screen.getByRole('button', { name: /collapse sidebar/i });
    fireEvent.click(toggleBtn);

    // Sidebar has .collapsed class
    const aside = container.querySelector('aside');
    expect(aside.className).toContain('collapsed');

    // All items remain in the exact same order in DOM
    const navLinks = screen.getAllByRole('link');
    const labels = navLinks.map((l) => l.getAttribute('data-tip')).filter(Boolean);
    expect(labels).toEqual(['Chat', 'Library', 'Prompt Vault', 'Interview']);
    expect(screen.getByRole('button', { name: /toggle more navigation links/i })).toHaveAttribute('data-tip', 'More');
  });
});

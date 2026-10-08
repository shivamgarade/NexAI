import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SearchPage from './SearchPage';
import { useChatStore } from '@/store/chatStore';
import { useSearchStore } from '@/store/searchStore';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('SearchPage Component', () => {
  const mockChats = [
    {
      _id: 'chat-1',
      title: 'First AI Chat',
      snippet: 'Discussing neural networks',
      updatedAt: '2026-10-01T12:00:00Z',
    },
    {
      _id: 'chat-2',
      title: 'Database Schema Design',
      snippet: 'MongoDB indexing patterns',
      updatedAt: '2026-10-02T12:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    useChatStore.setState({
      chats: mockChats,
      fetchChats: vi.fn(),
      updateChatTitle: vi.fn(),
      deleteChat: vi.fn(),
      deleteMultipleChats: vi.fn(),
    });

    useSearchStore.setState({
      query: '',
      results: { library: [], prompts: [], chats: [] },
      counts: { total: 0, library: 0, prompts: 0, chats: 0 },
      isLoading: false,
      error: null,
      recentSearches: ['indexing'],
      performSearch: vi.fn(),
      clearSearch: vi.fn(),
      removeRecentSearch: vi.fn(),
      clearRecentSearches: vi.fn(),
    });
  });

  it('renders all conversations initially in grid view', () => {
    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Search Conversations')).toBeInTheDocument();
    expect(screen.getByText('First AI Chat')).toBeInTheDocument();
    expect(screen.getByText('Database Schema Design')).toBeInTheDocument();
    expect(screen.getByText(/2 conversations/i)).toBeInTheDocument();
  });

  it('toggles between Cards Grid view and Compact List view', () => {
    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>,
    );

    const listBtn = screen.getByLabelText('Compact List View');
    fireEvent.click(listBtn);
    expect(listBtn).toHaveClass(/active/);

    const gridBtn = screen.getByLabelText('Cards Grid View');
    fireEvent.click(gridBtn);
    expect(gridBtn).toHaveClass(/active/);
  });

  it('supports selecting individual chats and select all for bulk actions', () => {
    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>,
    );

    const selectAllCheckbox = screen.getByRole('checkbox', { name: /Select all conversations/i });
    expect(selectAllCheckbox).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(selectAllCheckbox);
    expect(screen.getByText(/chats selected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete Selected \(2\)/i })).toBeInTheDocument();

    const deselectBtn = screen.getByRole('button', { name: /Deselect All/i });
    fireEvent.click(deselectBtn);
    expect(screen.queryByText(/chats selected/i)).not.toBeInTheDocument();
  });

  it('supports opening rename modal from 3-dots menu and saving new title', async () => {
    const updateTitleMock = vi.fn().mockResolvedValue({});
    useChatStore.setState({ updateChatTitle: updateTitleMock });

    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>,
    );

    const optionsButtons = screen.getAllByLabelText('Conversation options');
    fireEvent.click(optionsButtons[0]);

    const renameItem = screen.getByRole('menuitem', { name: /Rename Title/i });
    fireEvent.click(renameItem);

    expect(screen.getByText('Rename Conversation')).toBeInTheDocument();
    const editInput = screen.getByDisplayValue('First AI Chat');
    fireEvent.change(editInput, { target: { value: 'Renamed Chat Title' } });

    const saveBtn = screen.getByRole('button', { name: 'Save Changes' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateTitleMock).toHaveBeenCalledWith('chat-1', 'Renamed Chat Title');
    });
  });

  it('confirms and executes single chat deletion from 3-dots menu', async () => {
    const deleteChatMock = vi.fn().mockResolvedValue(true);
    useChatStore.setState({ deleteChat: deleteChatMock });

    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>,
    );

    const optionsButtons = screen.getAllByLabelText('Conversation options');
    fireEvent.click(optionsButtons[0]);

    const deleteItem = screen.getByRole('menuitem', { name: /Delete Conversation/i });
    fireEvent.click(deleteItem);

    expect(screen.getByText(/Are you sure you want to delete "First AI Chat"/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteChatMock).toHaveBeenCalledWith('chat-1');
    });
  });

  it('confirms and executes bulk chat deletion', async () => {
    const deleteMultipleMock = vi.fn().mockResolvedValue(true);
    useChatStore.setState({ deleteMultipleChats: deleteMultipleMock });

    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>,
    );

    const selectAllCheckbox = screen.getByRole('checkbox', { name: /Select all conversations/i });
    fireEvent.click(selectAllCheckbox);

    const bulkDeleteBtn = screen.getByRole('button', { name: /Delete Selected \(2\)/i });
    fireEvent.click(bulkDeleteBtn);

    expect(screen.getByText(/Are you sure you want to delete 2 selected conversations/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Delete 2 Chats/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteMultipleMock).toHaveBeenCalledWith(['chat-1', 'chat-2']);
    });
  });

  it('navigates to chat when card is clicked', () => {
    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>,
    );

    const card = screen.getByText('First AI Chat');
    fireEvent.click(card);

    expect(mockNavigate).toHaveBeenCalledWith('/chat/chat-1');
  });

  it('renders inline recent search chips and triggers search on click', () => {
    const performSearchMock = vi.fn();
    useSearchStore.setState({
      recentSearches: ['neural', 'docker'],
      performSearch: performSearchMock,
    });

    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Recent:')).toBeInTheDocument();
    const neuralChip = screen.getByText('neural');
    expect(neuralChip).toBeInTheDocument();
    expect(screen.getByText('docker')).toBeInTheDocument();

    fireEvent.click(neuralChip);
    expect(performSearchMock).toHaveBeenCalledWith('neural', 'chats');
  });

  it('allows removing an individual recent search chip and clearing all chips', () => {
    const removeRecentMock = vi.fn();
    const clearRecentMock = vi.fn();
    useSearchStore.setState({
      recentSearches: ['neural'],
      removeRecentSearch: removeRecentMock,
      clearRecentSearches: clearRecentMock,
    });

    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>,
    );

    const removeBtn = screen.getByLabelText(/Remove neural/i);
    fireEvent.click(removeBtn);
    expect(removeRecentMock).toHaveBeenCalledWith('neural');

    const clearAllBtn = screen.getByRole('button', { name: /Clear all/i });
    fireEvent.click(clearAllBtn);
    expect(clearRecentMock).toHaveBeenCalled();
  });
});

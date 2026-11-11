import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Topbar } from './Topbar';
import { useChatStore } from '@/store/chatStore';
import { useUiStore } from '@/store/uiStore';

describe('Topbar Component - In-place Chat Title Editing', () => {
  let updateChatTitleMock;

  beforeEach(() => {
    vi.useFakeTimers();
    updateChatTitleMock = vi.fn().mockResolvedValue({ _id: 'chat-1', title: 'Updated Title' });

    useUiStore.setState({
      drawerOpen: false,
      setDrawerOpen: vi.fn(),
    });

    useChatStore.setState({
      chats: [
        { _id: 'chat-1', title: 'Original Chat Title' },
        { _id: 'chat-2', title: 'Another Chat' },
      ],
      activeChatId: 'chat-1',
      isTemporaryChat: false,
      updateChatTitle: updateChatTitleMock,
      startTemporaryChat: vi.fn(),
      clearTemporaryChat: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders chat title capsule when active on /chat/:id', () => {
    render(
      <MemoryRouter initialEntries={['/chat/chat-1']}>
        <Topbar />
      </MemoryRouter>
    );

    expect(screen.getByText('Original Chat Title')).toBeInTheDocument();
  });

  it('enters inline edit mode when clicking on chat title capsule', () => {
    render(
      <MemoryRouter initialEntries={['/chat/chat-1']}>
        <Topbar />
      </MemoryRouter>
    );

    const capsule = screen.getByTitle('Click to rename chat');
    fireEvent.click(capsule);

    const input = screen.getByRole('textbox', { name: /edit chat title/i });
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('Original Chat Title');
  });

  it('saves immediately and exits edit mode on Enter key', async () => {
    render(
      <MemoryRouter initialEntries={['/chat/chat-1']}>
        <Topbar />
      </MemoryRouter>
    );

    // Enter edit mode
    fireEvent.click(screen.getByTitle('Click to rename chat'));
    const input = screen.getByRole('textbox', { name: /edit chat title/i });

    // Change title
    fireEvent.change(input, { target: { value: 'New Renamed Title' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(updateChatTitleMock).toHaveBeenCalledWith('chat-1', 'New Renamed Title');
    expect(screen.queryByRole('textbox', { name: /edit chat title/i })).not.toBeInTheDocument();
  });

  it('auto-saves when user stops typing for 1000ms (debounce)', async () => {
    render(
      <MemoryRouter initialEntries={['/chat/chat-1']}>
        <Topbar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTitle('Click to rename chat'));
    const input = screen.getByRole('textbox', { name: /edit chat title/i });

    fireEvent.change(input, { target: { value: 'Auto-saved Title' } });

    // Fast-forward 500ms - should not have saved yet
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(updateChatTitleMock).not.toHaveBeenCalled();

    // Fast-forward another 600ms (total > 1000ms)
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(updateChatTitleMock).toHaveBeenCalledWith('chat-1', 'Auto-saved Title');
  });

  it('saves and exits edit mode on blur', async () => {
    render(
      <MemoryRouter initialEntries={['/chat/chat-1']}>
        <Topbar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTitle('Click to rename chat'));
    const input = screen.getByRole('textbox', { name: /edit chat title/i });

    fireEvent.change(input, { target: { value: 'Blurred Title' } });
    await act(async () => {
      fireEvent.blur(input);
    });

    expect(updateChatTitleMock).toHaveBeenCalledWith('chat-1', 'Blurred Title');
    expect(screen.queryByRole('textbox', { name: /edit chat title/i })).not.toBeInTheDocument();
  });

  it('cancels editing and reverts title on Escape key without saving', () => {
    render(
      <MemoryRouter initialEntries={['/chat/chat-1']}>
        <Topbar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTitle('Click to rename chat'));
    const input = screen.getByRole('textbox', { name: /edit chat title/i });

    fireEvent.change(input, { target: { value: 'Discarded Title' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(updateChatTitleMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: /edit chat title/i })).not.toBeInTheDocument();
    expect(screen.getByText('Original Chat Title')).toBeInTheDocument();
  });

  it('does not allow editing ephemeral temporary chat title', () => {
    useChatStore.setState({
      isTemporaryChat: true,
    });

    render(
      <MemoryRouter initialEntries={['/chat/chat-1']}>
        <Topbar />
      </MemoryRouter>
    );

    expect(screen.getByText('Temporary Chat')).toBeInTheDocument();
    expect(screen.queryByTitle('Click to rename chat')).not.toBeInTheDocument();
  });
});

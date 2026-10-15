import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ChatHero } from './ChatHero';
import { getFirstName, getGreetingContext } from './greetingHelper';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ChatHero Component and Context Awareness', () => {
  beforeEach(() => {
    useChatStore.setState({
      selectedModel: 'flash',
      setSelectedModel: vi.fn((m) => useChatStore.setState({ selectedModel: m })),
      insufficientCredits: false,
      isStreaming: false,
    });
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
    });
  });

  describe('getFirstName helper', () => {
    it('extracts first name from user.name if provided', () => {
      expect(getFirstName({ name: 'Alex Johnson' })).toBe('Alex');
      expect(getFirstName({ name: 'sarah connor' })).toBe('Sarah');
    });

    it('extracts and capitalizes username from email when name is missing', () => {
      expect(getFirstName({ email: 'john.doe@example.com' })).toBe('John');
      expect(getFirstName({ email: 'shivam_garade@gmail.com' })).toBe('Shivam');
      expect(getFirstName({ email: 'developer@test.io' })).toBe('Developer');
    });

    it('returns null when user is null or lacks valid name and email', () => {
      expect(getFirstName(null)).toBeNull();
      expect(getFirstName({})).toBeNull();
      expect(getFirstName({ email: 'invalid-email' })).toBeNull();
    });
  });

  describe('getGreetingContext helper', () => {
    it('returns Late Night greeting between 00:00 and 04:59', () => {
      const lateNight = new Date('2026-10-03T02:30:00');
      const anon = getGreetingContext(null, lateNight);
      expect(anon.period).toBe('night');
      expect(anon.timeLabel).toBe('Late Night');
      expect(anon.headline).toBe('Hey night owl, where should we start?');

      const userGreeting = getGreetingContext({ name: 'Neo' }, lateNight);
      expect(userGreeting.headline).toBe('Burning the midnight oil, Neo?');
    });

    it('returns Morning greeting between 05:00 and 11:59', () => {
      const morning = new Date('2026-10-03T08:15:00');
      const anon = getGreetingContext(null, morning);
      expect(anon.period).toBe('morning');
      expect(anon.timeLabel).toBe('Morning');
      expect(anon.headline).toBe('Good morning! Where should we start?');

      const userGreeting = getGreetingContext({ name: 'Alice' }, morning);
      expect(userGreeting.headline).toBe('Good morning, Alice!');
    });

    it('returns Afternoon greeting between 12:00 and 16:59', () => {
      const afternoon = new Date('2026-10-03T14:45:00');
      const anon = getGreetingContext(null, afternoon);
      expect(anon.period).toBe('afternoon');
      expect(anon.timeLabel).toBe('Afternoon');
      expect(anon.headline).toBe('Good afternoon! Where should we start?');

      const userGreeting = getGreetingContext({ name: 'Bob' }, afternoon);
      expect(userGreeting.headline).toBe('Good afternoon, Bob!');
    });

    it('returns Evening greeting between 17:00 and 20:59', () => {
      const evening = new Date('2026-10-03T18:30:00');
      const anon = getGreetingContext(null, evening);
      expect(anon.period).toBe('evening');
      expect(anon.timeLabel).toBe('Evening');
      expect(anon.headline).toBe('Good evening! Where should we start?');

      const userGreeting = getGreetingContext({ name: 'Charlie' }, evening);
      expect(userGreeting.headline).toBe('Good evening, Charlie!');
    });

    it('returns Late Evening greeting between 21:00 and 23:59', () => {
      const night = new Date('2026-10-03T22:10:00');
      const anon = getGreetingContext(null, night);
      expect(anon.period).toBe('late-evening');
      expect(anon.timeLabel).toBe('Night');
      expect(anon.headline).toBe('Working late? Where should we start?');

      const userGreeting = getGreetingContext({ name: 'Diana' }, night);
      expect(userGreeting.headline).toBe('Working late, Diana?');
    });
  });

  describe('ChatHero UI rendering', () => {
    it('renders context-aware headline, subtitle, and input card without extra badge tag', () => {
      renderWithRouter(<ChatHero onSendPrompt={vi.fn()} />);

      expect(screen.queryByTestId('greeting-badge')).not.toBeInTheDocument();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading.textContent).toMatch(/where should we start|burning the midnight oil|good morning|good afternoon|good evening|working late/i);

      expect(screen.getByLabelText(/ask nexai anything/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/attach context file/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/voice input not supported in this browser/i)).toBeInTheDocument();
    });

    it('renders personalized greeting when authenticated user is in store', () => {
      useAuthStore.setState({
        user: { name: 'Elena Rostova', email: 'elena@example.com' },
        isAuthenticated: true,
      });

      renderWithRouter(<ChatHero onSendPrompt={vi.fn()} />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading.textContent).toContain('Elena');
    });

    it('renders starter prompt suggestion chips and triggers callback when clicked', () => {
      const handleSendPrompt = vi.fn();
      renderWithRouter(<ChatHero onSendPrompt={handleSendPrompt} />);

      expect(screen.getByText('Explain a Concept')).toBeInTheDocument();
      expect(screen.getByText('Code Assistance')).toBeInTheDocument();
      expect(screen.getByText('Professional Writing')).toBeInTheDocument();
      expect(screen.getByText('System Architecture')).toBeInTheDocument();

      const conceptChip = screen.getByRole('button', { name: /explain a concept/i });
      fireEvent.click(conceptChip);

      expect(handleSendPrompt).toHaveBeenCalledWith(
        'Explain quantum computing in simple, intuitive terms.',
      );
    });

    it('submits text input on form submission', () => {
      const handleSendPrompt = vi.fn();
      renderWithRouter(<ChatHero onSendPrompt={handleSendPrompt} />);

      const textarea = screen.getByLabelText(/ask nexai anything/i);
      fireEvent.change(textarea, { target: { value: 'How does an event loop work in Node.js?' } });

      const sendBtn = screen.getByLabelText(/send prompt/i);
      expect(sendBtn).not.toBeDisabled();

      fireEvent.click(sendBtn);

      expect(handleSendPrompt).toHaveBeenCalledWith('How does an event loop work in Node.js?');
      expect(textarea.value).toBe('');
    });

    it('submits on Enter keypress without Shift', () => {
      const handleSendPrompt = vi.fn();
      renderWithRouter(<ChatHero onSendPrompt={handleSendPrompt} />);

      const textarea = screen.getByLabelText(/ask nexai anything/i);
      fireEvent.change(textarea, { target: { value: 'Explain closures' } });

      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      expect(handleSendPrompt).toHaveBeenCalledWith('Explain closures');
    });
  });
});

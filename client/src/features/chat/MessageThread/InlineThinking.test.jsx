import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InlineThinking } from './InlineThinking';

// Mock clipboard
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.assign(navigator, { clipboard: mockClipboard });

describe('InlineThinking Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing if thoughts are empty and isThinking is false', () => {
    const { container } = render(<InlineThinking thoughts="" isThinking={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders thinking state when isThinking is true', () => {
    render(<InlineThinking thoughts="" isThinking={true} />);
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
  });

  it('expands thoughts on header click and does NOT show redundant "Thinking process" title', () => {
    render(
      <InlineThinking
        thoughts="**Defining the Goal**\n\nI am outlining the solution."
        defaultExpanded={false}
      />
    );

    // Initially collapsed
    expect(screen.queryByRole('region')).not.toBeInTheDocument();

    // Toggle expand
    const headerBtn = screen.getByRole('button', { name: /toggle thinking trace/i });
    fireEvent.click(headerBtn);

    // Expanded region exists
    expect(screen.getByRole('region')).toBeInTheDocument();

    // Redundant title "Thinking process" must NOT be present
    expect(screen.queryByText(/thinking process/i)).not.toBeInTheDocument();

    // Copy button is present
    expect(screen.getByRole('button', { name: /copy reasoning trace/i })).toBeInTheDocument();
  });

  it('properly formats markdown content without raw markdown asterisks', () => {
    render(
      <InlineThinking
        thoughts="**Defining the Goal**"
        defaultExpanded={true}
      />
    );

    // The strong element should exist with formatted text
    const strongElement = screen.getByText('Defining the Goal');
    expect(strongElement.tagName.toLowerCase()).toBe('strong');

    // Raw markdown asterisks should not be visible in text
    expect(screen.queryByText(/\*\*Defining the Goal\*\*/)).not.toBeInTheDocument();
  });

  it('copies thoughts to clipboard on copy button click', async () => {
    render(
      <InlineThinking
        thoughts="Detailed reasoning step"
        defaultExpanded={true}
      />
    );

    const copyBtn = screen.getByRole('button', { name: /copy reasoning trace/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith('Detailed reasoning step');
    });
  });
});

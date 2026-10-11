import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CreditBadge } from '../CreditBadge';

describe('CreditBadge Component', () => {
  it('renders daily quota count and quota label', () => {
    render(<CreditBadge dailyRequestsRemaining={1486} />);
    expect(screen.getByText(/Quota:/i)).toBeInTheDocument();
    expect(screen.getByText('1,486')).toBeInTheDocument();
    expect(screen.getByText(/\/ 1,500 left/i)).toBeInTheDocument();
  });

  it('triggers onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(<CreditBadge onClick={handleClick} />);

    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

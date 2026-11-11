import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NexAiLogo } from './NexAiLogo';

describe('NexAiLogo Component', () => {
  it('renders SVG with custom size and accessible label', () => {
    render(<NexAiLogo size={32} ariaLabel="Brand Monogram" />);
    const svg = screen.getByRole('img', { name: 'Brand Monogram' });
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
    expect(svg).toHaveAttribute('viewBox', '0 0 512 512');
  });

  it('renders gradient definition using CSS variables by default', () => {
    const { container } = render(<NexAiLogo size={24} />);
    const stops = container.querySelectorAll('stop');
    expect(stops.length).toBe(2);
    expect(stops[0]).toHaveAttribute('stop-color', 'var(--color-logo-primary, #10e7b2)');
    expect(stops[1]).toHaveAttribute('stop-color', 'var(--color-logo-accent, #00f0ff)');
  });

  it('supports solid custom color override', () => {
    const { container } = render(<NexAiLogo color="#ff0055" />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(2);
    expect(paths[0]).toHaveAttribute('fill', '#ff0055');
    expect(paths[1]).toHaveAttribute('fill', '#ff0055');
  });
});

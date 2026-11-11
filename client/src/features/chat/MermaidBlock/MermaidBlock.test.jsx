import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MermaidBlock } from './MermaidBlock';
import { DiagramLightbox } from './DiagramLightbox';

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    parse: vi.fn().mockResolvedValue(true),
    render: vi.fn().mockResolvedValue({
      svg: '<svg id="test-mermaid-svg"><g><text>Process 1</text></g></svg>',
    }),
  },
}));

describe('MermaidBlock & DiagramLightbox', () => {
  const sampleChart = `%% Gantt CPU Scheduling
gantt
    title CPU Scheduling
    dateFormat  X
    axisFormat %s
    section P1
    Task : 0, 5`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders inline diagram block with badge and tabs', async () => {
    render(<MermaidBlock chart={sampleChart} />);

    expect(screen.getByText('Architecture Diagram')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /diagram/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /code/i })).toBeInTheDocument();
  });

  it('opens interactive lightbox when clicking on the diagram canvas', async () => {
    render(<MermaidBlock chart={sampleChart} />);

    // Wait for debounce timer (30ms) and mermaid render to finish
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /click to open interactive diagram/i })).toBeInTheDocument();
    });

    const canvas = screen.getByRole('button', { name: /click to open interactive diagram/i });
    fireEvent.click(canvas);

    // Lightbox modal should be open
    expect(screen.getByRole('dialog', { name: /interactive diagram view/i })).toBeInTheDocument();
    expect(screen.getByText(/drag to pan • ctrl \+ wheel to zoom/i)).toBeInTheDocument();
  });

  it('opens interactive lightbox when clicking the Expand toolbar button', async () => {
    render(<MermaidBlock chart={sampleChart} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open interactive view/i })).toBeInTheDocument();
    });

    const expandBtn = screen.getByRole('button', { name: /open interactive view/i });
    fireEvent.click(expandBtn);

    expect(screen.getByRole('dialog', { name: /interactive diagram view/i })).toBeInTheDocument();
  });

  it('supports zoom in, zoom out and reset in the lightbox', async () => {
    render(
      <DiagramLightbox
        isOpen={true}
        onClose={vi.fn()}
        svgContent='<svg id="test-svg"></svg>'
        title="Test Gantt Chart"
      />
    );

    expect(screen.getByText('100%')).toBeInTheDocument();

    const zoomInBtn = screen.getByRole('button', { name: /zoom in/i });
    const zoomOutBtn = screen.getByRole('button', { name: /zoom out/i });

    fireEvent.click(zoomInBtn);
    expect(screen.getByText('125%')).toBeInTheDocument();

    fireEvent.click(zoomOutBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('closes lightbox on Escape key press', () => {
    const onCloseMock = vi.fn();
    render(
      <DiagramLightbox
        isOpen={true}
        onClose={onCloseMock}
        svgContent='<svg id="test-svg"></svg>'
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('closes lightbox when clicking the close button', () => {
    const onCloseMock = vi.fn();
    render(
      <DiagramLightbox
        isOpen={true}
        onClose={onCloseMock}
        svgContent='<svg id="test-svg"></svg>'
      />
    );

    const closeBtn = screen.getByRole('button', { name: /close interactive view/i });
    fireEvent.click(closeBtn);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});

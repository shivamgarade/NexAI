import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentStepTimeline } from './AgentStepTimeline';

describe('AgentStepTimeline Component', () => {
  it('renders nothing when there are no steps or sources', () => {
    const { container } = render(<AgentStepTimeline steps={[]} groundingMetadata={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders step summary and details when steps are present', () => {
    const steps = [
      {
        id: 'step-1',
        tool: 'web_search',
        title: 'Searching web for Node.js clustering',
        status: 'completed',
        output: 'Found 5 relevant documentation pages',
      },
    ];

    render(<AgentStepTimeline steps={steps} />);

    expect(screen.getByText(/Agent completed 1 action/i)).toBeInTheDocument();

    // Toggle expansion
    const toggleBtn = screen.getByRole('button');
    fireEvent.click(toggleBtn);

    expect(screen.getByText('Searching web for Node.js clustering')).toBeInTheDocument();
    expect(screen.getByText('Found 5 relevant documentation pages')).toBeInTheDocument();
  });

  it('renders web sources badge and citations when groundingMetadata is provided', () => {
    const groundingMetadata = {
      sources: [
        { title: 'Node.js Cluster Docs', uri: 'https://nodejs.org/api/cluster.html' },
      ],
    };

    render(<AgentStepTimeline steps={[]} groundingMetadata={groundingMetadata} isStreaming={true} />);

    expect(screen.getByText(/1 web sources/i)).toBeInTheDocument();
    expect(screen.getByText('Node.js Cluster Docs')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Node.js Cluster Docs/i })).toHaveAttribute(
      'href',
      'https://nodejs.org/api/cluster.html',
    );
  });
});

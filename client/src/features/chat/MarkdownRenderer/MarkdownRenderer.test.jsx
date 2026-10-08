import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MarkdownRenderer } from './MarkdownRenderer';
import { normalizeTableMarkdown } from './tableNormalizer';

describe('MarkdownRenderer Table Support', () => {
  it('correctly normalizes inline table rows joined by double pipes and pipes', () => {
    const rawContent = `Stack Comparison (Table)
| Layer | Technology | Primary Use Case || | :--- | :--- | :--- || | **UI Styling** | Tailwind CSS | Rapid UI design & responsiveness || | **Caching** | Redis | Session store & high-speed caching || | **Deployment** | Docker & AWS | Containerization & cloud hosting |`;

    const normalized = normalizeTableMarkdown(rawContent);

    expect(normalized).toContain('| Layer | Technology | Primary Use Case |');
    expect(normalized).toContain('| :--- | :--- | :--- |');
    expect(normalized).toContain('| **UI Styling** | Tailwind CSS | Rapid UI design & responsiveness |');
    expect(normalized).toContain('| **Caching** | Redis | Session store & high-speed caching |');
    expect(normalized).toContain('| **Deployment** | Docker & AWS | Containerization & cloud hosting |');
  });

  it('preserves code blocks without corrupting double pipe logic operators', () => {
    const rawContent = `\`\`\`javascript
const isValid = a || b || c;
\`\`\`
| Col A | Col B || | :--- | :--- || | 1 | 2 |`;

    const normalized = normalizeTableMarkdown(rawContent);
    expect(normalized).toContain('const isValid = a || b || c;');
    expect(normalized).toContain('| Col A | Col B |');
  });

  it('renders a table as proper HTML table elements with remark-gfm', () => {
    const rawContent = `Stack Comparison (Table)
| Layer | Technology | Primary Use Case || | :--- | :--- | :--- || | **UI Styling** | Tailwind CSS | Rapid UI design & responsiveness || | **Caching** | Redis | Session store & high-speed caching |`;

    const { container } = render(<MarkdownRenderer content={rawContent} />);

    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();

    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual(['Layer', 'Technology', 'Primary Use Case']);

    const cells = screen.getAllByRole('cell');
    expect(cells.some((c) => c.textContent === 'Tailwind CSS')).toBe(true);
    expect(cells.some((c) => c.textContent === 'Redis')).toBe(true);
  });

  it('renders a dedicated PromptBlock when markdown contains ```prompt block', () => {
    const rawContent = `Here is your requested prompt:
\`\`\`prompt
Analyze the following quarterly financial report for {{company_name}} focusing on {{metrics}}.
\`\`\`
Let me know if you want revisions!`;

    const onSave = vi.fn();
    render(<MarkdownRenderer content={rawContent} onSavePrompt={onSave} />);

    expect(screen.getByText('Prompt Template')).toBeInTheDocument();
    expect(screen.getByText('2 variables')).toBeInTheDocument();
    expect(screen.getByText('Save to Vault')).toBeInTheDocument();
  });
});


import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PromptBlock } from './PromptBlock';

describe('PromptBlock Component', () => {
  it('renders prompt template text and badge', () => {
    const template = 'Write a blog post about {{topic}} for {{audience}}.';
    render(<PromptBlock template={template} />);

    expect(screen.getByText('Prompt Template')).toBeInTheDocument();
    expect(screen.getByText('2 variables')).toBeInTheDocument();
    expect(screen.getByText('topic')).toBeInTheDocument();
    expect(screen.getByText('audience')).toBeInTheDocument();
  });

  it('triggers onSavePrompt callback with suggested title and variables', () => {
    const onSavePrompt = vi.fn();
    const template = 'Draft an email announcing {{product_name}} launch.';
    render(<PromptBlock template={template} onSavePrompt={onSavePrompt} />);

    const saveBtn = screen.getByRole('button', { name: /save to prompt vault/i });
    fireEvent.click(saveBtn);

    expect(onSavePrompt).toHaveBeenCalledTimes(1);
    expect(onSavePrompt).toHaveBeenCalledWith({
      title: 'AI Prompt: Draft an email announcing {{product_name}} launch.',
      template,
      tags: ['ai-generated', 'product_name'],
    });
  });

  it('triggers onUsePrompt callback when Use in Chat is clicked', () => {
    const onUsePrompt = vi.fn();
    const template = 'Explain quantum computing in simple terms.';
    render(<PromptBlock template={template} onUsePrompt={onUsePrompt} />);

    const useBtn = screen.getByRole('button', { name: /use in chat composer/i });
    fireEvent.click(useBtn);

    expect(onUsePrompt).toHaveBeenCalledTimes(1);
    expect(onUsePrompt).toHaveBeenCalledWith(template);
  });

  it('copies prompt template to clipboard on copy click', async () => {
    const writeTextMock = vi.fn().mockResolvedValue();
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const template = 'Act as a Senior React Engineer and review this code:';
    render(<PromptBlock template={template} />);

    const copyBtn = screen.getByRole('button', { name: /copy prompt/i });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(template);
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InterviewSetup } from './InterviewSetup';

describe('InterviewSetup Component', () => {
  const defaultProps = {
    role: 'Full-Stack Engineer',
    difficulty: 'mid',
    topic: 'MERN Stack Architecture & REST/WebSocket APIs',
    selectedModel: 'flash',
    onRoleChange: vi.fn(),
    onDifficultyChange: vi.fn(),
    onTopicChange: vi.fn(),
    onModelChange: vi.fn(),
    onStart: vi.fn(),
    isStarting: false,
    sessions: [],
    onSelectSession: vi.fn(),
  };

  it('renders role presets and triggers onRoleChange when clicked', () => {
    render(<InterviewSetup {...defaultProps} />);
    const reactBtn = screen.getByRole('button', { name: /Frontend React/i });
    fireEvent.click(reactBtn);
    expect(defaultProps.onRoleChange).toHaveBeenCalledWith('Frontend React');
  });

  it('renders difficulty options and triggers onDifficultyChange', () => {
    render(<InterviewSetup {...defaultProps} />);
    const seniorBtn = screen.getByText(/Senior \/ Lead/i);
    fireEvent.click(seniorBtn.closest('button'));
    expect(defaultProps.onDifficultyChange).toHaveBeenCalledWith('senior');
  });

  it('triggers onStart when Enter Simulation Arena is clicked', () => {
    render(<InterviewSetup {...defaultProps} />);
    const startBtn = screen.getByRole('button', {
      name: /Enter Simulation Arena/i,
    });
    fireEvent.click(startBtn);
    expect(defaultProps.onStart).toHaveBeenCalled();
  });

  it('renders voice engine options and triggers onVoiceEngineChange', () => {
    const onVoiceEngineChange = vi.fn();
    render(
      <InterviewSetup
        {...defaultProps}
        voiceEngine="edge"
        onVoiceEngineChange={onVoiceEngineChange}
      />,
    );

    const geminiBtn = screen.getByRole('button', { name: /Gemini 3.8 TTS/i });
    fireEvent.click(geminiBtn);
    expect(onVoiceEngineChange).toHaveBeenCalledWith('gemini');
  });
});

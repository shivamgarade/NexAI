import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MessageAttachments } from './MessageAttachments';

describe('MessageAttachments Component', () => {
  it('renders nothing when attachments array is empty or null', () => {
    const { container: c1 } = render(<MessageAttachments attachments={[]} />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(<MessageAttachments attachments={null} />);
    expect(c2.firstChild).toBeNull();
  });

  it('renders image attachment with preview and expands on click', () => {
    const attachments = [
      {
        name: 'sample-diagram.png',
        mimeType: 'image/png',
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        size: 2048,
        type: 'image',
      },
    ];

    render(<MessageAttachments attachments={attachments} />);

    const img = screen.getByAltText('sample-diagram.png');
    expect(img).toBeInTheDocument();
    expect(screen.getByText('sample-diagram.png')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();

    // Click to open lightbox
    const card = screen.getByRole('button', { name: /view full image/i });
    fireEvent.click(card);

    // Lightbox modal should be opened
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Download Image')).toBeInTheDocument();
  });

  it('renders video attachment with HTML5 video player', () => {
    const attachments = [
      {
        name: 'demo-video.mp4',
        mimeType: 'video/mp4',
        data: 'data:video/mp4;base64,AAAA',
        size: 1048576,
        type: 'video',
      },
    ];

    render(<MessageAttachments attachments={attachments} />);

    expect(screen.getByText('demo-video.mp4')).toBeInTheDocument();
    expect(screen.getByText('1.0 MB')).toBeInTheDocument();
    expect(screen.getAllByTitle('demo-video.mp4').length).toBeGreaterThanOrEqual(1);
  });

  it('renders PDF document card with view and download actions', () => {
    const attachments = [
      {
        name: 'report.pdf',
        mimeType: 'application/pdf',
        data: 'data:application/pdf;base64,JVBERi0xLjQK',
        size: 512000,
        type: 'pdf',
      },
    ];

    render(<MessageAttachments attachments={attachments} />);

    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText(/500.0 KB/)).toBeInTheDocument();

    const openBtn = screen.getByRole('button', { name: /open pdf document in new tab/i });
    expect(openBtn).toBeInTheDocument();

    const downloadLink = screen.getByRole('link', { name: /download pdf document/i });
    expect(downloadLink).toBeInTheDocument();
    expect(downloadLink).toHaveAttribute('download', 'report.pdf');
  });

  it('renders audio attachment with audio controls', () => {
    const attachments = [
      {
        name: 'voice-note.mp3',
        mimeType: 'audio/mp3',
        data: 'data:audio/mp3;base64,SUQzBAAAAA==',
        size: 65536,
        type: 'audio',
      },
    ];

    render(<MessageAttachments attachments={attachments} />);

    expect(screen.getByText('voice-note.mp3')).toBeInTheDocument();
    expect(screen.getByText('Audio')).toBeInTheDocument();
  });

  it('renders generic file card for other document formats', () => {
    const attachments = [
      {
        name: 'script.py',
        mimeType: 'text/x-python',
        data: 'data:text/plain;base64,cHJpbnQoIjEiKQ==',
        size: 120,
        type: 'file',
      },
    ];

    render(<MessageAttachments attachments={attachments} />);

    expect(screen.getByText('script.py')).toBeInTheDocument();
    const downloadLink = screen.getByRole('link', { name: /download file/i });
    expect(downloadLink).toBeInTheDocument();
    expect(downloadLink).toHaveAttribute('download', 'script.py');
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AttachmentLightbox } from './AttachmentLightbox';

describe('AttachmentLightbox Component', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(
      <AttachmentLightbox
        item={{ name: 'photo.jpg', src: 'data:image/png;base64,123', type: 'image' }}
        open={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders portal in document.body when open is true', () => {
    const onClose = vi.fn();
    render(
      <AttachmentLightbox
        item={{ name: 'photo.jpg', src: 'data:image/png;base64,123', type: 'image', size: 1024 }}
        open={true}
        onClose={onClose}
      />
    );

    const dialog = screen.getByRole('dialog', { name: /preview: photo\.jpg/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
    expect(screen.getByAltText('photo.jpg')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close preview/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape key press', () => {
    const onClose = vi.fn();
    render(
      <AttachmentLightbox
        item={{ name: 'document.pdf', src: 'http://example.com/doc.pdf', type: 'pdf' }}
        open={true}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

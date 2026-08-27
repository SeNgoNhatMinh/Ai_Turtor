import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SupportRichTextEditor from '../../src/components/support/SupportRichTextEditor';

describe('SupportRichTextEditor toolbar', () => {
  it('exposes Vietnamese labels on formatting tools', () => {
    render(<SupportRichTextEditor value="" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Đậm (Ctrl+B)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nghiêng (Ctrl+I)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gạch dưới (Ctrl+U)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xóa định dạng' })).toBeInTheDocument();
  });

  it('shows the tool name in the hover bubble', async () => {
    render(<SupportRichTextEditor value="" onChange={vi.fn()} />);

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Đậm (Ctrl+B)' }).parentElement);
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent('Đậm (Ctrl+B)');
    });
  });
});

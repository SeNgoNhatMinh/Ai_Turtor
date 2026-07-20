import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PromptStarters from '../../src/pages/student/PromptStarters';

describe('PromptStarters', () => {
  it('submits a complete prompt when a starter is clicked', () => {
    const onSelect = vi.fn();
    render(<PromptStarters onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Giải thích khái niệm' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toContain('Dựa trên tài liệu môn học');
  });

  it('disables every starter when chat context is unavailable', () => {
    render(<PromptStarters disabled onSelect={vi.fn()} />);

    screen.getAllByRole('button').forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('does not offer a context-free mentor request and disables actions without a handler', () => {
    render(<PromptStarters />);

    expect(screen.queryByRole('button', { name: 'Nhờ mentor hỗ trợ' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    screen.getAllByRole('button').forEach((button) => {
      expect(button).toBeDisabled();
    });
  });
});

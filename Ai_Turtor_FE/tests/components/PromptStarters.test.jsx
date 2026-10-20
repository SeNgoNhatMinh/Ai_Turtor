import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PromptStarters from '../../src/features/student/chat/components/PromptStarters';

describe('PromptStarters', () => {
  it('generates starters from syllabus topics when they are provided', () => {
    const onSelect = vi.fn();
    render(<PromptStarters onSelect={onSelect} topics={['Cú pháp Python', 'Vòng lặp']} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cú pháp Python' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toContain('Cú pháp Python');
    expect(onSelect.mock.calls[0][0]).toContain('Dựa trên tài liệu môn học');
    expect(screen.getByRole('button', { name: 'Vòng lặp' })).toBeInTheDocument();
  });

  it('falls back to a neutral syllabus question without inventing a topic', () => {
    const onSelect = vi.fn();
    render(<PromptStarters onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Hỏi về nội dung môn học' }));

    expect(onSelect.mock.calls[0][0]).toContain('syllabus chính thức');
  });

  it('disables every starter when chat context is unavailable', () => {
    render(<PromptStarters disabled onSelect={vi.fn()} topics={['Cú pháp Python']} />);

    screen.getAllByRole('button').forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('does not offer a context-free mentor request and disables actions without a handler', () => {
    render(<PromptStarters topics={['Cú pháp Python', 'Vòng lặp', 'Hàm']} />);

    expect(screen.queryByRole('button', { name: 'Nhờ mentor hỗ trợ' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    screen.getAllByRole('button').forEach((button) => {
      expect(button).toBeDisabled();
    });
  });
});

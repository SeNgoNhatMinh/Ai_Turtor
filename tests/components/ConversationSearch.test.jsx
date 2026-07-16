import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConversationSearch from '../../src/pages/student/ConversationSearch';

describe('ConversationSearch', () => {
  it('keeps a stable accessible search input and clears the query', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ConversationSearch value="constructor" onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Tìm cuộc trò chuyện' });
    expect(input).toHaveValue('constructor');

    fireEvent.click(screen.getByRole('button', { name: 'Xóa nội dung tìm kiếm' }));
    expect(onChange).toHaveBeenCalledWith('');

    rerender(<ConversationSearch value="" onChange={onChange} />);
    expect(input).toHaveAttribute('placeholder', 'Tìm cuộc trò chuyện...');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AnswerActionBar from '../../src/features/student/chat/components/AnswerActionBar';

describe('AnswerActionBar', () => {
  it('offers mentor review when the answer has no existing support request', () => {
    const onAction = vi.fn();
    render(<AnswerActionBar message={{ question: 'Servlet là gì?' }} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'Gửi mentor xem xét' }));

    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'mentor' }));
  });

  it('hides the mentor action while a request exists or is being created', () => {
    render(
      <AnswerActionBar
        message={{ question: 'Servlet là gì?' }}
        mentorRequestInProgress
        onAction={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Gửi mentor xem xét' })).not.toBeInTheDocument();
  });

  it('keeps retry available while hiding the duplicate mentor action', () => {
    render(
      <AnswerActionBar
        message={{ question: 'Servlet là gì?', aiServiceError: true }}
        mentorRequestInProgress
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Gửi xem xét' })).not.toBeInTheDocument();
  });
});

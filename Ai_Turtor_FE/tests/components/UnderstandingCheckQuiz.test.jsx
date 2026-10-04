import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UnderstandingCheckQuiz from '../../src/features/student/chat/components/UnderstandingCheckQuiz';

describe('UnderstandingCheckQuiz', () => {
  it('waits for the backend grade before revealing the answer', async () => {
    const onLockAnswer = vi.fn().mockResolvedValue({
      status: 'INCORRECT',
      attemptId: 'attempt-1',
      messageId: 'assistant-1',
      correct: false,
      correctKey: 'B',
      explanation: 'ViewResolver phân giải tên view.',
    });

    render(
      <UnderstandingCheckQuiz
        attemptId="assistant-1"
        quiz={{
          question: 'Spring xử lý tên view như thế nào?',
          options: [
            { key: 'A', text: 'Trả view trực tiếp' },
            { key: 'B', text: 'Gọi ViewResolver' },
            { key: 'C', text: 'Trả lỗi 404' },
          ],
          correctKey: '',
          explanation: '',
        }}
        onLockAnswer={onLockAnswer}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /C\s*Trả lỗi 404/i }));

    expect(await screen.findByText('Chưa đúng.')).toBeVisible();
    expect(screen.getByText(/Đáp án đúng là B/)).toBeVisible();
    expect(onLockAnswer).toHaveBeenCalledTimes(1);
  });
});

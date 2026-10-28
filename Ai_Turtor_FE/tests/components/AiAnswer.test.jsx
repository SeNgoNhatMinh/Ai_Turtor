import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AiAnswer from '../../src/components/AiAnswer';

const markdown = `
## Giải thích
Nội dung bài học.

## Kiểm tra hiểu

Q1.
Câu hỏi thứ nhất?
A. Một
B. Hai
C. Ba
D. Bốn
Đáp án đúng: B
Giải thích: Vì hai.

Q2.
Câu hỏi thứ hai?
A. Một
B. Hai
C. Ba
D. Bốn
Đáp án đúng: C
Giải thích: Vì ba.

Q3.
Câu hỏi thứ ba?
A. Một
B. Hai
C. Ba
D. Bốn
Đáp án đúng: A
Giải thích: Vì một.
`;

describe('AiAnswer', () => {
  it('shows every markdown quiz item even when the API payload carries only the first', () => {
    render(
      <AiAnswer
        markdown={markdown}
        understandingCheck={{
          question: 'Câu hỏi thứ nhất?',
          options: [
            { key: 'A', text: 'Một' },
            { key: 'B', text: 'Hai' },
            { key: 'C', text: 'Ba' },
            { key: 'D', text: 'Bốn' },
          ],
          correctKey: '',
          explanation: '',
        }}
      />,
    );

    expect(screen.getAllByLabelText('Kiểm tra hiểu')).toHaveLength(3);
    expect(screen.getByText('Câu hỏi thứ nhất?')).toBeVisible();
    expect(screen.getByText('Câu hỏi thứ hai?')).toBeVisible();
    expect(screen.getByText('Câu hỏi thứ ba?')).toBeVisible();
  });

  it('teacher view labels each quiz as wrong or skipped from saved attempts', () => {
    render(
      <AiAnswer
        markdown={markdown}
        reviewer
        understandingAttempts={[
          { quizIndex: 0, selectedKey: 'A', correct: false },
          { quizIndex: 1, selectedKey: '', correct: null },
        ]}
      />,
    );

    expect(screen.getByText('Sinh viên: Sai')).toBeVisible();
    // Q2 has an explicit skipped attempt; Q3 was never answered either.
    expect(screen.getAllByText('Sinh viên: Bỏ qua')).toHaveLength(2);
  });

  it('reports the quiz index when a later question is answered', () => {
    const onLockAnswer = vi.fn();
    render(<AiAnswer markdown={markdown} onLockAnswer={onLockAnswer} />);

    const secondQuiz = screen.getAllByLabelText('Kiểm tra hiểu')[1];
    fireEvent.click(secondQuiz.querySelectorAll('button')[1]);

    expect(onLockAnswer).toHaveBeenCalledTimes(1);
    expect(onLockAnswer.mock.calls[0][1]).toMatchObject({ quizIndex: 1 });
  });
});

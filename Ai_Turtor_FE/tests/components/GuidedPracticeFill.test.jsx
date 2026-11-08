import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AiAnswer from '../../src/components/AiAnswer';

const quizMarkdown = `## 2. Bài tập có hướng dẫn

\`\`\`java
void ____(____ req) {}
\`\`\`

## Kiểm tra hiểu

Q1. Method nhận request là gì?
A. service()
B. init()
C. destroy()
D. doGet()
Đáp án đúng: D
Giải thích: doGet nhận GET.`;

describe('guided practice fill', () => {
  it('saves the blank without asking for a new answer', () => {
    const onSubmitGuidedPractice = vi.fn();
    render(
      <AiAnswer
        markdown={'## 2. Bài tập có hướng dẫn\n\n```java\nvoid ____() {}\n```'}
        onSubmitGuidedPractice={onSubmitGuidedPractice}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Chỗ trống 1' }), {
      target: { value: 'doGet' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu bài làm' }));

    expect(onSubmitGuidedPractice).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Đã nộp' })).toBeDisabled();
    expect(screen.getByText('Đã lưu bài làm. Không tạo câu trả lời mới.')).toBeVisible();
  });

  it('keeps every blank editable until the quiz is also finished', () => {
    const onSubmitGuidedPractice = vi.fn();
    render(
      <AiAnswer
        attemptId="assistant-1"
        markdown={quizMarkdown}
        onSubmitGuidedPractice={onSubmitGuidedPractice}
      />,
    );

    const [method, request] = screen.getAllByRole('textbox');
    fireEvent.change(method, { target: { value: 'doGet' } });
    fireEvent.change(request, { target: { value: 'req' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu bài làm' }));

    expect(onSubmitGuidedPractice).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Đã lưu bài làm' })).toBeDisabled();
    expect(screen.getByText(/Bạn vẫn sửa được/)).toBeVisible();
    expect(JSON.parse(localStorage.getItem('guided-practice-draft:assistant-1')).text)
      .toContain('void doGet(req req)');
  });

  it('explains mistakes only after the quiz is finished, not when the draft is saved', () => {
    const onSubmitGuidedPractice = vi.fn();
    const view = render(
      <AiAnswer
        attemptId="assistant-2"
        markdown={quizMarkdown}
        understandingAttempts={[{ quizIndex: 0, selectedKey: 'A' }]}
        onSubmitGuidedPractice={onSubmitGuidedPractice}
      />,
    );

    expect(screen.getByText(/Đã lưu lựa chọn A/)).toBeVisible();
    expect(screen.queryByText(/Đúng rồi|Chưa đúng/)).toBeNull();

    const [method, request] = screen.getAllByRole('textbox');
    fireEvent.change(method, { target: { value: 'doGet' } });
    fireEvent.change(request, { target: { value: 'req' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu bài làm' }));

    expect(screen.getByText(/Đúng rồi\.|Chưa đúng\./)).toBeVisible();
    expect(onSubmitGuidedPractice).not.toHaveBeenCalled();

    view.rerender(
      <AiAnswer
        attemptId="assistant-2"
        markdown={quizMarkdown}
        understandingAttempts={[]}
        onSubmitGuidedPractice={onSubmitGuidedPractice}
      />,
    );
    view.rerender(
      <AiAnswer
        attemptId="assistant-2"
        markdown={quizMarkdown}
        understandingAttempts={[{ quizIndex: 0, selectedKey: 'A' }]}
        onSubmitGuidedPractice={onSubmitGuidedPractice}
      />,
    );

    expect(onSubmitGuidedPractice).toHaveBeenCalledWith(expect.stringContaining('Hãy sửa bài'));
    expect(onSubmitGuidedPractice).toHaveBeenCalledWith(expect.stringContaining('void doGet(req req)'));
  });
});

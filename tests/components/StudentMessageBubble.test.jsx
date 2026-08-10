import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StudentMessageBubble from '../../src/features/student/chat/components/StudentMessageBubble';

describe('StudentMessageBubble', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('copies the original student question', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <StudentMessageBubble
        canResend
        question="Servlet là gì?"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sao chép tin nhắn' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Servlet là gì?'));
    expect(screen.getByRole('button', { name: 'Đã sao chép' })).toBeVisible();
  });

  it('edits inline and resends without changing the original message', () => {
    const onResend = vi.fn();

    render(
      <StudentMessageBubble
        canResend
        question="Servlet là gì?"
        onResend={onResend}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sửa và gửi lại tin nhắn' }));
    const editor = screen.getByRole('textbox', { name: 'Chỉnh sửa câu hỏi' });
    fireEvent.change(editor, { target: { value: 'Giải thích Servlet đơn giản hơn' } });
    fireEvent.click(screen.getByRole('button', { name: /gửi lại/i }));

    expect(onResend).toHaveBeenCalledWith('Giải thích Servlet đơn giản hơn');
    expect(screen.getByText('Servlet là gì?')).toBeVisible();
  });

  it('keeps resend disabled when the conversation cannot accept another question', () => {
    render(
      <StudentMessageBubble
        canResend={false}
        question="Servlet là gì?"
      />,
    );

    expect(screen.getByRole('button', { name: 'Sửa và gửi lại tin nhắn' })).toBeDisabled();
  });
});

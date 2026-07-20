import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TeacherActionCenter from '../../src/features/teacher/classes/TeacherActionCenter';

describe('TeacherActionCenter', () => {
  it('routes a real queue item to its owning feature', () => {
    const onNavigate = vi.fn();
    render(
      <TeacherActionCenter
        hasScope
        items={[{
          key: 'quiz-review',
          title: '2 bài quiz chờ duyệt điểm',
          description: 'Kiểm tra điểm tự động.',
          status: 'PENDING_REVIEW',
          tab: 'teacher-grading',
        }]}
        onNavigate={onNavigate}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /2 bài quiz chờ duyệt điểm/i }));
    expect(onNavigate).toHaveBeenCalledWith('teacher-grading');
  });

  it('does not load actions until a canonical class scope exists', () => {
    render(<TeacherActionCenter hasScope={false} items={[]} onRefresh={vi.fn()} />);
    expect(screen.getByText('Chọn môn và lớp để tải hàng chờ công việc.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeDisabled();
  });
});

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
          key: 'escalations',
          title: '2 yêu cầu hỗ trợ đang mở',
          description: 'Trao đổi và gửi câu trả lời chính thức cho sinh viên.',
          status: 'OPEN',
          tab: 'teacher-escalations',
        }]}
        onNavigate={onNavigate}
        onRefresh={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /2 yêu cầu hỗ trợ đang mở/i }));
    expect(onNavigate).toHaveBeenCalledWith('teacher-escalations');
  });

  it('does not load actions until a canonical class scope exists', () => {
    render(<TeacherActionCenter hasScope={false} items={[]} onRefresh={vi.fn()} />);
    expect(screen.getByText('Chọn môn và lớp để tải hàng chờ công việc.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeDisabled();
  });
});

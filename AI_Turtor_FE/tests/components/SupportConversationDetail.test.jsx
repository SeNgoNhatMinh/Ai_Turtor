import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SupportConversationDetail from '../../src/features/student/mentor-review/components/SupportConversationDetail';

describe('SupportConversationDetail', () => {
  it('renders the previous AI answer with markdown structure', () => {
    render(
      <SupportConversationDetail
        ticket={{
          id: 'escalation-1',
          questionPreview: 'Servlet là gì?',
          originalQuestion: 'Servlet là gì?',
          aiResponse: '## Khái niệm\n\nServlet xử lý request.\n\n- `init()`\n- `service()`',
          mentorAnswer: 'Câu trả lời đã được giảng viên xác nhận.',
          status: 'COMPLETED',
        }}
        isLoading={false}
        error=""
        currentUser={{ id: 'student-1', role: 'STUDENT' }}
        onEscalationChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Câu trả lời AI trước đó')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Khái niệm' })).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('service()')).toBeVisible();
  });
});

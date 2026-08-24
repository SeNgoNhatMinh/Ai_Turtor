import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TeacherSupportInbox from '../../src/features/teacher/review/TeacherSupportInbox';

vi.mock('../../src/components/support/SupportChatRoom', () => ({
  default: ({ chatRoomId, readOnly }) => (
    <div>Lịch sử {chatRoomId} · {readOnly ? 'chỉ đọc' : 'đang trao đổi'}</div>
  ),
}));

const tickets = [
  {
    id: 'active-1',
    status: 'CHAT_ACTIVE',
    student: 'Sinh viên A',
    question: 'Em cần hiểu rõ hơn về kế thừa trong Java.',
    title: 'Kế thừa trong Java',
    chatRoomId: 'room-active',
  },
  {
    id: 'closed-1',
    status: 'COMPLETED',
    student: 'Sinh viên B',
    question: 'Câu hỏi dài đã hoàn tất và cần xem lại đầy đủ trong lịch sử.',
    title: 'Servlet và JSP',
    chatRoomId: 'room-closed',
  },
];

function InboxHarness() {
  const [selected, setSelected] = useState(tickets[0]);
  return (
    <TeacherSupportInbox
      currentUser={{ id: 'teacher-1', role: 'TEACHER' }}
      escalations={tickets}
      selectedEscalation={selected}
      onSelectEscalation={setSelected}
      onRefresh={vi.fn()}
      reply=""
      onReplyChange={vi.fn()}
      onSubmitAnswer={vi.fn()}
      createKnowledgeCandidate={false}
      onCreateKnowledgeCandidateChange={vi.fn()}
      candidateType="ACADEMIC_KNOWLEDGE"
      onCandidateTypeChange={vi.fn()}
    />
  );
}

describe('TeacherSupportInbox history', () => {
  it('opens completed ChatRoom history in read-only mode', () => {
    render(<InboxHarness />);

    fireEvent.click(screen.getByRole('radio', { name: 'Đã xử lý 1' }));
    fireEvent.click(screen.getByRole('button', { name: /Sinh viên B/i }));

    expect(screen.getByText('Câu hỏi dài đã hoàn tất và cần xem lại đầy đủ trong lịch sử.')).toBeInTheDocument();
    expect(screen.getByText('Lịch sử room-closed · chỉ đọc')).toBeInTheDocument();
    expect(screen.queryByLabelText('Câu trả lời cuối sau khi trao đổi:')).not.toBeInTheDocument();
  });
});

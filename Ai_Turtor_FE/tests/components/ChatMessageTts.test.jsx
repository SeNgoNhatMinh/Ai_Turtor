import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ChatMessageList from '../../src/features/student/chat/components/ChatMessageList';

vi.mock('../../src/components/AiAnswer', () => ({
  default: ({ markdown, courseMaterialHeadingAddon }) => (
    <div>
      {String(markdown).includes('Theo tài liệu môn học') ? (
        <>
          <h3>Theo tài liệu môn học</h3>
          {courseMaterialHeadingAddon}
          <p>Nội dung bài học.</p>
        </>
      ) : markdown}
    </div>
  ),
}));

const feedback = {
  isFeedbackSubmitting: false,
  feedbackOpenIndex: null,
  feedbackPanelMode: '',
  feedbackAction: '',
  feedbackText: '',
  setFeedbackText: vi.fn(),
  submitQuickReview: vi.fn(),
  toggleRatingPanel: vi.fn(),
  selectStarRating: vi.fn(),
  openFeedbackForm: vi.fn(),
  closeFeedbackForm: vi.fn(),
  submitFeedback: vi.fn(),
};

const baseProps = {
  activeSessionId: 'conversation-1',
  activeSessionMaxTurnsReached: false,
  canChat: true,
  classId: 'SE1832',
  courseId: 'PRJ301',
  currentUser: { email: 'student@example.com' },
  feedback,
  highlightedMessageKey: '',
  isAiLoading: false,
  materialSourceMap: {},
  messagesEndRef: { current: null },
  pinnedMessageIdSet: new Set(),
  pinningMessageId: '',
  studentName: 'Student',
  togglePinnedMessage: vi.fn(),
  userId: 'student-1',
};

describe('ChatMessageList TTS action', () => {
  it('renders one Read action for the AI answer and none for a pending user-only turn', () => {
    const { rerender } = render(
      <ChatMessageList
        {...baseProps}
        messages={[{ id: 'turn-1', question: 'Kế thừa là gì?', pending: true }]}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Đọc câu trả lời của AI Tutor' })).not.toBeInTheDocument();

    rerender(
      <ChatMessageList
        {...baseProps}
        messages={[{ id: 'turn-1', question: 'Kế thừa là gì?', answer: 'Kế thừa là...', sessionComplete: true }]}
      />,
    );

    expect(screen.getAllByRole('button', { name: 'Đọc câu trả lời của AI Tutor' })).toHaveLength(1);
  });

  it('moves the Read and voice controls below the course-material heading', () => {
    render(
      <ChatMessageList
        {...baseProps}
        voiceId="voice-long"
        ttsVoices={[{ id: 'voice-long', name: 'Long' }]}
        messages={[{
          id: 'turn-1',
          question: 'Servlet là gì?',
          answer: 'Theo tài liệu môn học\n\n- Servlet chạy trên server.',
          sessionComplete: true,
        }]}
      />,
    );

    const heading = screen.getByRole('heading', { name: 'Theo tài liệu môn học' });
    const readButton = screen.getByRole('button', { name: 'Đọc câu trả lời của AI Tutor' });
    expect(heading.nextElementSibling).toContainElement(readButton);
    expect(screen.getByText('Long')).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Đọc câu trả lời của AI Tutor' })).toHaveLength(1);
  });

  it('renders curriculum starter suggestions as clickable study chips', () => {
    const onStudySuggestion = vi.fn();
    render(
      <ChatMessageList
        {...baseProps}
        onStudySuggestion={onStudySuggestion}
        messages={[{
          id: 'welcome-1',
          question: '',
          sessionComplete: true,
          answer: `## 4. Gợi ý học tập

Bạn có thể bắt đầu bằng cách hỏi AI Tutor:

- Tôi muốn tìm hiểu về Tổng quan về Pascal.
- Kiểm tra kiến thức của tôi về Cấu trúc rẽ nhánh & Vòng lặp.

**Mẹo:** Hãy chọn một chủ đề cụ thể.`,
        }]}
      />,
    );

    const studyButtons = screen.getAllByRole('button', { name: /Học ngay/ });
    expect(studyButtons).toHaveLength(2);
    fireEvent.click(studyButtons[0]);
    expect(onStudySuggestion).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Tôi muốn tìm hiểu về Tổng quan về Pascal.',
      curriculumStarter: true,
    }));
  });

  it('hides the previous suggestion box while the next lesson answer is loading', () => {
    render(
      <ChatMessageList
        {...baseProps}
        onStudySuggestion={vi.fn()}
        messages={[
          {
            id: 'turn-1',
            question: 'Học Servlet',
            answer: 'Servlet chạy trên máy chủ.',
            nextImproveSuggestions: [{ text: 'Học tiếp JSP' }],
          },
          {
            id: 'turn-2',
            question: 'Học tiếp JSP',
            pending: true,
          },
        ]}
      />,
    );

    expect(screen.queryByRole('button', { name: /Học ngay/ })).not.toBeInTheDocument();
  });

  it('shows the completed lesson as Đã học beside the next suggestions', () => {
    const learned = { key: 'text:học servlet', text: 'Học Servlet' };
    render(
      <ChatMessageList
        {...baseProps}
        onStudySuggestion={vi.fn()}
        learnedSuggestions={[learned]}
        messages={[{
          id: 'turn-1',
          question: 'Học Servlet',
          clickedSuggestion: 'Học Servlet',
          studySuggestionKey: 'text:học servlet',
          answer: 'Servlet chạy trên máy chủ.',
          nextImproveSuggestions: [{ text: 'Học tiếp JSP' }],
        }]}
      />,
    );

    expect(screen.getByLabelText('Học Servlet - Đã học')).toBeVisible();
    expect(screen.getByRole('button', { name: /Học ngay/ })).toBeVisible();
  });

  it('uses curriculum lessons as next suggestions when the AI response omits them', () => {
    render(
      <ChatMessageList
        {...baseProps}
        onStudySuggestion={vi.fn()}
        fallbackStudySuggestions={[
          { text: 'Học Servlet và JSP' },
          { text: 'Học chương MVC' },
        ]}
        messages={[{
          id: 'turn-1',
          question: 'Servlet là gì?',
          answer: 'Servlet xử lý request phía máy chủ.',
          mode: 'RAG',
          outcome: 'ANSWERED',
        }]}
      />,
    );

    expect(screen.getByText('Học Servlet và JSP')).toBeVisible();
    expect(screen.getByText('Học chương MVC')).toBeVisible();
    expect(screen.getAllByRole('button', { name: /Học ngay/ })).toHaveLength(2);
  });

  it('does not show study suggestions for an escalated response', () => {
    render(
      <ChatMessageList
        {...baseProps}
        onStudySuggestion={vi.fn()}
        fallbackStudySuggestions={[{ text: 'Học chương MVC' }]}
        messages={[{
          id: 'turn-1',
          question: 'Học Servlet',
          answer: 'Câu hỏi đã được gửi cho giáo viên/mentor phụ trách.',
          mode: 'ESCALATE',
          outcome: 'NEEDS_MENTOR',
          questionEscalationId: 'escalation-1',
          studySuggestionKey: 'text:học servlet',
        }]}
      />,
    );

    expect(screen.queryByRole('region', { name: 'Gợi ý học tập' })).not.toBeInTheDocument();
    expect(screen.queryByText('Đã học')).not.toBeInTheDocument();
  });
});

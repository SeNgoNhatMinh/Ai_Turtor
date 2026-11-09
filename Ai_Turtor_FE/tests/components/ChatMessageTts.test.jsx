import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ChatMessageList from '../../src/features/student/chat/components/ChatMessageList';

vi.mock('../../src/components/AiAnswer', () => ({
  default: ({ markdown }) => <div>{markdown}</div>,
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

  it('renders curriculum chapter suggestions with show-more paging', () => {
    const onStudySuggestion = vi.fn();
    const chapters = [
      'Tổng quan về Pascal',
      'Cấu trúc rẽ nhánh',
      'Kiểu dữ liệu',
      'Hàm và thủ tục',
      'Mảng một chiều',
      'Con trỏ',
      'File',
    ];
    render(
      <ChatMessageList
        {...baseProps}
        onStudySuggestion={onStudySuggestion}
        messages={[{
          id: 'welcome-1',
          question: '',
          sessionComplete: true,
          answer: `## 4. Gợi ý học tập

Các chương trong tài liệu môn học (chọn một chương để bắt đầu):

${chapters.map((title) => `- ${title}`).join('\n')}

**Mẹo:** Chọn một chương cụ thể.`,
        }]}
      />,
    );

    expect(screen.getAllByRole('button', { name: /Học ngay/ })).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: /Hiển thị thêm/ }));
    expect(screen.getAllByRole('button', { name: /Học ngay/ })).toHaveLength(7);
    fireEvent.click(screen.getByRole('button', { name: /Ẩn bớt/ }));
    expect(screen.getAllByRole('button', { name: /Học ngay/ })).toHaveLength(5);
    fireEvent.change(screen.getByRole('searchbox', { name: /Tìm bài học/ }), {
      target: { value: 'Con trỏ' },
    });
    expect(screen.getAllByRole('button', { name: /Học ngay/ })).toHaveLength(1);
    fireEvent.click(screen.getAllByRole('button', { name: /Học ngay/ })[0]);
    expect(onStudySuggestion).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Con trỏ',
      curriculumStarter: true,
    }));
  });
});


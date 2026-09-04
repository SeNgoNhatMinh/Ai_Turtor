import { render, screen } from '@testing-library/react';
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
});

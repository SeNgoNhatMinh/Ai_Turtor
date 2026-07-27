import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GroupedAnswerReviewCard from '../../src/features/teacher/review/GroupedAnswerReviewCard';

const group = {
  id: 'rep-1',
  representativeReviewId: 'rep-1',
  answerFingerprint: 'fp-1',
  courseId: 'PRJ301',
  classId: 'SE1840',
  question: 'JSP là gì?',
  answer: 'JSP là Java Server Pages...',
  queueStatus: 'NEEDS_MENTOR_REVIEW',
  escalationTier: 'MODERATE',
  distinctStudentCount: 3,
  reviewCount: 3,
  averageRating: 2.3,
  evidence: [
    { reviewId: 'r1', studentId: 'sv-a', rating: 2, feedback: 'Giải thích chưa rõ' },
    { reviewId: 'r2', studentId: 'sv-b', rating: 3, feedback: 'Thiếu ví dụ' },
  ],
};

describe('GroupedAnswerReviewCard', () => {
  it('renders aggregated crowd summary for mentor queue', () => {
    render(<GroupedAnswerReviewCard group={group} queue="mentor" />);

    expect(screen.getByText(/3 sinh viên phản hồi về cùng câu trả lời AI/)).toBeInTheDocument();
    expect(screen.getByText('JSP là gì?')).toBeInTheDocument();
    expect(screen.getByText(/JSP là Java Server Pages/)).toBeInTheDocument();
  });

  it('enables senior resolve when notes and correction provided', () => {
    render(
      <GroupedAnswerReviewCard
        group={{ ...group, escalationTier: 'SEVERE', queueStatus: 'NEEDS_SENIOR_REVIEW' }}
        queue="senior"
        onDraftChange={vi.fn()}
        onResolve={vi.fn()}
        draft={{ notes: 'Verified', correctedAnswer: 'Correct JSP definition.' }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Tạo Knowledge Candidate (Flow 3)' })).toBeEnabled();
  });
});

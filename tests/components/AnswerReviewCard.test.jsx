import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AnswerReviewCard from '../../src/features/teacher/review/AnswerReviewCard';

const review = {
  id: 'review-1',
  studentName: 'Student A',
  courseId: 'PRO192',
  classId: 'SE1833',
  status: 'NEEDS_SENIOR_REVIEW',
  reviewType: 'SOURCE_CONFLICT',
  rating: 1,
  accurate: false,
  helpful: false,
  question: 'What is inheritance?',
  answer: 'The AI described inheritance incorrectly.',
  feedback: 'This conflicts with chapter 4.',
  suggestedCorrection: 'Use the superclass definition from chapter 4.',
};

describe('AnswerReviewCard', () => {
  it('renders complete answer review evidence', () => {
    render(<AnswerReviewCard review={review} queue="mentor" />);

    expect(screen.getByText('Student A')).toBeInTheDocument();
    expect(screen.getByText('What is inheritance?')).toBeInTheDocument();
    expect(screen.getByText('The AI described inheritance incorrectly.')).toBeInTheDocument();
    expect(screen.getByText('This conflicts with chapter 4.')).toBeInTheDocument();
    expect(screen.getByText('Use the superclass definition from chapter 4.')).toBeInTheDocument();
  });

  it('requires notes and correction before creating a candidate', () => {
    const { rerender } = render(
      <AnswerReviewCard review={review} queue="senior" draft={{ notes: '', correctedAnswer: '' }} />,
    );

    expect(screen.getByRole('button', { name: 'Tạo Knowledge Candidate' })).toBeDisabled();

    rerender(
      <AnswerReviewCard
        review={review}
        queue="senior"
        onDraftChange={vi.fn()}
        onResolve={vi.fn()}
        draft={{
          notes: 'Verified against course material.',
          correctedAnswer: 'Correct academic answer.',
        }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Tạo Knowledge Candidate' })).toBeEnabled();
  });

  it('keeps senior mutation controls disabled when handlers are missing', () => {
    render(
      <AnswerReviewCard
        review={review}
        queue="senior"
        draft={{ notes: 'Verified.', correctedAnswer: 'Correct answer.' }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Xử lý, không cập nhật AI' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tạo Knowledge Candidate' })).toBeDisabled();
  });

  it('renders resolved reviews as read-only history', () => {
    render(
      <AnswerReviewCard
        review={{
          ...review,
          status: 'RESOLVED',
          correctedAnswer: 'Verified answer from the mentor.',
          resolvedByName: 'Senior A',
          resolutionNote: 'Checked against the indexed course material.',
          linkedKnowledgeCandidateId: 'candidate-1',
        }}
        queue="history"
      />,
    );

    expect(screen.getByText('Phản hồi đã được xử lý')).toBeVisible();
    expect(screen.getByText('Verified answer from the mentor.')).toBeVisible();
    expect(screen.getByText(/Người xử lý: Senior A/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Tạo Knowledge Candidate' })).not.toBeInTheDocument();
  });
});

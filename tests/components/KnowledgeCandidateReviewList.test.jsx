import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import KnowledgeCandidateReviewList from '../../src/pages/teacher/KnowledgeCandidateReviewList';

const candidate = {
  id: 'candidate-1',
  teacherId: 'senior-1',
  status: 'PENDING_SENIOR_REVIEW',
  courseId: 'PRJ301',
  question: 'Spring Boot là gì?',
  content: 'Nội dung đã được Senior sửa ở Flow 3.5.',
};

describe('KnowledgeCandidateReviewList flow separation', () => {
  it('prevents the Flow 3.5 author from approving their own candidate in Flow 4', () => {
    render(
      <KnowledgeCandidateReviewList
        candidates={[candidate]}
        candidateNotes={{ 'candidate-1': 'Duyệt' }}
        canReviewKnowledgeCandidates
        currentReviewerId="senior-1"
        handleNoteChange={vi.fn()}
        handleApproveCandidate={vi.fn()}
        handleRejectCandidate={vi.fn()}
      />,
    );

    expect(screen.getByText(/Bạn đã tạo Candidate này ở Flow 3.5/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Phê duyệt vào tri thức AI' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Yêu cầu chỉnh sửa' })).toBeDisabled();
  });
});

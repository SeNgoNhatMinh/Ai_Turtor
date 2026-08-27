import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import KnowledgeCandidateReviewList from '../../src/features/teacher/review/KnowledgeCandidateReviewList';

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

    expect(screen.getByText(/Bạn là người tạo đề xuất này/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Phê duyệt vào tri thức AI' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeDisabled();
  });

  it('confirms an explicit rejection with the reviewer reason', async () => {
    const rejectCandidate = vi.fn().mockResolvedValue(true);
    const handleNoteChange = vi.fn();

    render(
      <KnowledgeCandidateReviewList
        candidates={[candidate]}
        candidateNotes={{ 'candidate-1': 'Nội dung chưa khớp giáo trình.' }}
        canReviewKnowledgeCandidates
        currentReviewerId="senior-2"
        handleNoteChange={handleNoteChange}
        handleApproveCandidate={vi.fn()}
        handleRejectCandidate={rejectCandidate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }));
    expect(screen.getByRole('alertdialog', { name: 'Từ chối tri thức này?' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Từ chối' }).at(-1));

    await waitFor(() => {
      expect(rejectCandidate).toHaveBeenCalledWith(
        'candidate-1',
        'Nội dung chưa khớp giáo trình.',
      );
    });
    expect(handleNoteChange).toHaveBeenCalledWith('candidate-1', '');
  });

  it('warns when the pending question is already indexed with another answer', () => {
    render(
      <KnowledgeCandidateReviewList
        candidates={[{
          ...candidate,
          teacherId: 'teacher-1',
          existingAcademicKnowledge: {
            id: 'indexed-1',
            question: 'Spring Boot la gi',
            answer: 'Đáp án cũ trong RAG',
            status: 'INDEXED',
          },
        }]}
        candidateNotes={{ 'candidate-1': 'Duyệt thay thế' }}
        canReviewKnowledgeCandidates
        currentReviewerId="senior-2"
        handleNoteChange={vi.fn()}
        handleApproveCandidate={vi.fn()}
        handleRejectCandidate={vi.fn()}
      />,
    );

    expect(screen.getByText('Câu hỏi này đã có trong RAG')).toBeVisible();
    expect(screen.getByText(/thay thế đáp án đang nạp/)).toBeVisible();
  });

  it('renders indexed and rejected candidates as read-only history', () => {
    render(
      <KnowledgeCandidateReviewList
        history
        candidates={[
          {
            ...candidate,
            status: 'REJECTED',
            reviewerName: 'Senior B',
            rejectionReason: 'Chưa đúng nội dung giáo trình.',
            reviewedAt: '2026-08-03T10:00:00Z',
          },
        ]}
      />,
    );

    expect(screen.getByText('Đã từ chối')).toBeVisible();
    expect(screen.getByText('Senior B')).toBeVisible();
    expect(screen.getByText('Chưa đúng nội dung giáo trình.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Từ chối' })).not.toBeInTheDocument();
  });
});

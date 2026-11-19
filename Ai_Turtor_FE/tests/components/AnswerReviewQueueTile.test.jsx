import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AnswerReviewQueueTile from '../../src/features/teacher/review/AnswerReviewQueueTile';
import AnswerReviewWorkspace from '../../src/features/teacher/review/AnswerReviewWorkspace';

const watchGroup = {
  id: 'rep-1',
  representativeReviewId: 'rep-1',
  answerFingerprint: 'fp-watch',
  courseId: 'PRJ301',
  classId: 'SE1832',
  question: 'Vòng đời của Servlet gồm các hàm nào (init, service, destroy)?',
  answer: 'Hãy dán mã nguồn trước khi gửi Code Mentor.',
  queueStatus: 'NEEDS_SENIOR_REVIEW',
  escalationTier: 'SEVERE',
  distinctStudentCount: 1,
  reviewCount: 1,
  negativeReviewCount: 1,
  alertLevel: 'WATCH',
  redAlert: false,
};

const redGroup = {
  ...watchGroup,
  id: 'rep-2',
  representativeReviewId: 'rep-2',
  answerFingerprint: 'fp-red',
  question: 'JSP là gì?',
  distinctStudentCount: 6,
  reviewCount: 8,
  negativeReviewCount: 8,
  similarQuestionCount: 2,
  alertLevel: 'RED',
  redAlert: true,
};

describe('AnswerReviewQueueTile', () => {
  it('keeps a single bad rating as a watch tile', () => {
    render(<AnswerReviewQueueTile group={watchGroup} onOpen={vi.fn()} />);
    expect(screen.getByText('Mới 1 góp ý — chưa cần xử lý')).toBeInTheDocument();
    expect(screen.getByText(/1 lượt đánh giá tệ/)).toBeInTheDocument();
  });

  it('marks a cluster with many bad ratings as red', () => {
    render(<AnswerReviewQueueTile group={redGroup} onOpen={vi.fn()} />);
    expect(screen.getByText('Nhiều đánh giá tệ — cần xử lý')).toBeInTheDocument();
    expect(screen.getByText(/8 lượt đánh giá tệ/)).toBeInTheDocument();
  });
});

describe('AnswerReviewWorkspace queue tiles', () => {
  it('opens the composer only after a tile is clicked', () => {
    render(
      <AnswerReviewWorkspace
        mode="senior"
        groups={[watchGroup]}
        onResolveReview={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Phản hồi cần xử lý/ }));
    expect(screen.queryByRole('button', { name: 'Đề xuất tri thức đúng' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Vòng đời của Servlet/ }));
    expect(screen.getByRole('button', { name: 'Đề xuất tri thức đúng' })).toBeInTheDocument();
  });

  it('opens one knowledge candidate from a tile, then returns to the grid', () => {
    render(
      <AnswerReviewWorkspace
        mode="senior"
        candidates={[{
          id: 'candidate-1',
          teacherId: 'teacher-1',
          courseId: 'PRJ301',
          question: 'jspInit() là gì',
          content: 'jspInit chạy một lần',
          status: 'PENDING_SENIOR_REVIEW',
        }]}
        candidateNotes={{ 'candidate-1': 'Duyệt' }}
        currentReviewerId="senior-2"
        onApproveCandidate={vi.fn()}
        onRejectCandidate={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Phê duyệt vào tri thức AI' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /jspInit\(\) là gì/ }));
    expect(screen.getByRole('button', { name: 'Phê duyệt vào tri thức AI' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại danh sách' }));
    expect(screen.queryByRole('button', { name: 'Phê duyệt vào tri thức AI' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /jspInit\(\) là gì/ })).toBeInTheDocument();
  });

  it('opens one history record from a tile', () => {
    render(
      <AnswerReviewWorkspace
        mode="senior"
        reviewedCandidates={[{
          id: 'candidate-rejected',
          courseId: 'PRJ301',
          question: 'Rejected candidate question',
          content: 'Rejected answer',
          status: 'REJECTED',
          reviewerName: 'Senior Reviewer',
          rejectionReason: 'Nội dung chưa chính xác.',
          reviewedAt: '2026-08-03T09:00:00Z',
        }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Lịch sử/ }));
    expect(screen.queryByText('Nội dung chưa chính xác.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Rejected candidate question/ }));
    expect(screen.getByText('Nội dung chưa chính xác.')).toBeInTheDocument();
  });
});

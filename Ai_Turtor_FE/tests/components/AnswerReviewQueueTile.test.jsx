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

    expect(screen.queryByRole('button', { name: 'Đề xuất tri thức đúng' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Vòng đời của Servlet/ }));
    expect(screen.getByRole('button', { name: 'Đề xuất tri thức đúng' })).toBeInTheDocument();
  });
});

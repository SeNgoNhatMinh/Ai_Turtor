import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EvaluationDashboard from '../../src/features/expert-training/components/EvaluationDashboard';
import StatusLabel from '../../src/components/common/StatusLabel';

const evaluationProps = {
  runs: [],
  loading: false,
  error: '',
  pendingAction: '',
  detail: null,
  detailLoading: false,
  onRefresh: vi.fn(),
  onStart: vi.fn(),
  onOpenDetail: vi.fn(),
  onCloseDetail: vi.fn(),
};

describe('Tutor V2 UI rules', () => {
  it('disables Evaluation with a canonical readiness reason', () => {
    const { rerender } = render(
      <EvaluationDashboard
        {...evaluationProps}
        canReview
        readiness={{ ready: false, holdoutCount: 0, reason: 'Cần holdout đã duyệt.', warning: '' }}
      />,
    );

    expect(screen.getByText('Cần holdout đã duyệt.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chạy Evaluation' })).toBeDisabled();

    rerender(
      <EvaluationDashboard
        {...evaluationProps}
        canReview
        readiness={{ ready: true, holdoutCount: 2, reason: '', warning: '' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Chạy Evaluation' })).toBeEnabled();
  });

  it('keeps Evaluation execution hidden from teachers', () => {
    render(
      <EvaluationDashboard
        {...evaluationProps}
        canReview={false}
        readiness={{ ready: true, holdoutCount: 2, reason: '', warning: '' }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Chạy Evaluation' })).not.toBeInTheDocument();
    expect(screen.getByText('Bạn đang ở chế độ chỉ xem')).toBeInTheDocument();
  });

  it('renders canonical statuses with consistent Vietnamese labels', () => {
    render(
      <>
        <StatusLabel status="PENDING_REVIEW" />
        <StatusLabel status="INDEXED" />
        <StatusLabel status="REJECTED" />
      </>,
    );

    expect(screen.getByText('Chờ kiểm duyệt')).toBeInTheDocument();
    expect(screen.getByText('Đã đưa vào RAG')).toBeInTheDocument();
    expect(screen.getByText('Cần chỉnh sửa')).toBeInTheDocument();
  });
});

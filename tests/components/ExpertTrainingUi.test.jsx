import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EvaluationDashboard from '../../src/features/expert-training/components/EvaluationDashboard';
import StatusLabel from '../../src/components/common/StatusLabel';
import ChapterCoveragePanel from '../../src/features/expert-training/components/ChapterCoveragePanel';
import ContributionWorkspace from '../../src/features/expert-training/components/ContributionWorkspace';
import ConfirmCard from '../../src/components/common/ConfirmCard';

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

  it('keeps chapter confirmation and task creation hidden from teachers', () => {
    const props = {
      chapters: [{
        id: 'chapter-1',
        chapterKey: 'oop',
        title: 'Object-Oriented Programming',
        status: 'SUGGESTED',
        materialHealth: 'MATERIAL_OK',
        detectedFrom: 'PDF_BOOKMARK',
        chunkCount: 8,
        tocLevel: 1,
      }],
      loading: false,
      error: '',
      pendingAction: '',
      preview: null,
      previewLoading: false,
      previewError: '',
      onRefresh: vi.fn(),
      onConfirm: vi.fn(),
      onAddManual: vi.fn(),
      onPreview: vi.fn(),
      onClosePreview: vi.fn(),
      onCreateTasks: vi.fn(),
      onOpenMaterial: vi.fn(),
    };
    const { rerender } = render(<ChapterCoveragePanel {...props} canReview={false} />);

    expect(screen.queryByRole('button', { name: /Xác nhận/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thêm chapter' })).not.toBeInTheDocument();
    expect(screen.getByText(/Chapter do Senior Mentor/)).toBeInTheDocument();

    rerender(<ChapterCoveragePanel {...props} canReview />);
    expect(screen.getByRole('button', { name: /Xác nhận/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm chapter' })).toBeInTheDocument();
  });

  it('prevents a teacher from submitting another teacher task', () => {
    render(
      <ContributionWorkspace
        selectedTask={{
          id: 'task-1',
          type: 'GOLD_QA',
          status: 'ASSIGNED',
          assigneeId: 'teacher-2',
          chapter: 'OOP',
          title: 'Soạn Gold Q&A',
          instructions: 'usage=TRAINING',
        }}
        userId="teacher-1"
        pendingAction=""
        onSubmitGoldQa={vi.fn()}
        onSubmitRubric={vi.fn()}
        materialPreview={null}
        materialLoading={false}
        materialError=""
        rejection={null}
        onOpenMaterial={vi.fn()}
      />,
    );

    expect(screen.getByText('Task này không thuộc về bạn')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi kiểm duyệt' })).toBeDisabled();
  });

  it('renders Rubric criteria without leaking duplicate React keys', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <ContributionWorkspace
          selectedTask={{
            id: 'rubric-task-1',
            type: 'RUBRIC',
            status: 'ASSIGNED',
            assigneeId: 'teacher-1',
            chapter: 'Collections',
            title: 'Rubric chất lượng câu trả lời',
            instructions: 'Đánh giá độ chính xác và bám nguồn.',
          }}
          userId="teacher-1"
          pendingAction=""
          onSubmitGoldQa={vi.fn()}
          onSubmitRubric={vi.fn()}
          materialPreview={null}
          materialLoading={false}
          materialError=""
          rejection={null}
          onOpenMaterial={vi.fn()}
        />,
      );

      const keyWarnings = consoleError.mock.calls.filter(([message]) => (
        String(message).includes('same key') || String(message).includes('key prop is being spread')
      ));
      expect(keyWarnings).toHaveLength(0);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('keeps an anchored confirmation usable when the page scrolls', () => {
    const onClose = vi.fn();
    render(
      <ConfirmCard
        title="Phê duyệt nội dung?"
        content="Xác nhận dữ liệu trước khi gửi backend."
        okText="Phê duyệt"
        cancelText="Hủy"
        onOk={vi.fn()}
        onClose={onClose}
        anchorRect={{ top: 100, right: 500, bottom: 132 }}
      />,
    );

    window.dispatchEvent(new Event('scroll'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Phê duyệt nội dung?' })).toBeInTheDocument();
  });
});

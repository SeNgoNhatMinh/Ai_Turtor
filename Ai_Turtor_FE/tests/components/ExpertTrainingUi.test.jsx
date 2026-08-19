import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EvaluationDashboard from '../../src/features/expert-training/components/EvaluationDashboard';
import StatusLabel from '../../src/components/common/StatusLabel';
import ChapterCoveragePanel from '../../src/features/expert-training/components/ChapterCoveragePanel';
import ChapterPreviewDrawer from '../../src/features/expert-training/components/ChapterPreviewDrawer';
import ContributionWorkspace from '../../src/features/expert-training/components/ContributionWorkspace';
import ConfirmCard from '../../src/components/common/ConfirmCard';

vi.mock('../../src/services/materialsApi', () => ({
  materialsApi: {
    getMaterialPageImage: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
  },
}));

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

  it('hides start-chapter from teachers', () => {
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
        pageStart: 12,
        sourceMaterialIds: ['M1'],
        primarySourceMaterialId: 'M1',
      }],
      tasks: [],
      goldQa: [],
      loading: false,
      error: '',
      pendingAction: '',
      onRefresh: vi.fn(),
      onClosePreview: vi.fn(),
      onStartChapter: vi.fn(),
      onOpenMaterial: vi.fn(),
      onIgnoreChapter: vi.fn(),
    };
    const { rerender } = render(<ChapterCoveragePanel {...props} canReview={false} />);

    expect(screen.queryByRole('button', { name: 'Bắt đầu chương' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xóa khỏi mục lục/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Senior bắt đầu chương train/)).toBeInTheDocument();

    rerender(<ChapterCoveragePanel {...props} canReview />);
    expect(screen.getByRole('button', { name: 'Bắt đầu chương' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xóa khỏi mục lục Object-Oriented Programming' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở PDF Object-Oriented Programming' })).toBeInTheDocument();
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
    expect(screen.getByLabelText('Chương')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Gửi và chấm thi' })).toBeDisabled();
  });

  it('lets Senior start an indexed chapter without a separate confirm step', () => {
    const onStartChapter = vi.fn();
    render(
      <ChapterPreviewDrawer
        courseId="PRJ301"
        chapter={{ chapterKey: 'oop', title: 'OOP', status: 'SUGGESTED', chunkCount: 4 }}
        preview={{
          title: 'OOP',
          status: 'SUGGESTED',
          hasMaterialContent: true,
          materialHealth: 'MATERIAL_OK',
          sourceMaterials: [],
          chunkCount: 4,
          approxChars: 1200,
        }}
        session={{ key: 'NOT_STARTED', label: 'Chưa train' }}
        canReview
        pendingAction=""
        onClose={vi.fn()}
        onStartChapter={onStartChapter}
        onOpenMaterial={vi.fn()}
        onIgnoreChapter={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu chương' }));
    expect(onStartChapter).toHaveBeenCalledWith(expect.objectContaining({ chapterKey: 'oop' }));
  });

  it('shows a visual book page in the chapter drawer', async () => {
    const onOpenMaterial = vi.fn();
    render(
      <ChapterPreviewDrawer
        courseId="PRJ301"
        chapter={{
          chapterKey: 'jspx-note',
          title: 'A Note about JSP Documents (JSPX)',
          status: 'SUGGESTED',
          chunkCount: 2,
          pageStart: 138,
          pageEnd: 139,
          sourceMaterialIds: ['M1'],
          primarySourceMaterialId: 'M1',
        }}
        preview={null}
        session={{ key: 'NOT_STARTED', label: 'Chưa train' }}
        canReview
        pendingAction=""
        onClose={vi.fn()}
        onStartChapter={vi.fn()}
        onOpenMaterial={onOpenMaterial}
        onIgnoreChapter={vi.fn()}
      />,
    );

    expect(await screen.findByRole('img', { name: /Trang 138/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tải PDF' }));
    expect(onOpenMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'M1', sourceType: 'PDF' }),
      expect.objectContaining({ pageStart: 138 }),
    );
    expect(screen.getByRole('button', { name: 'Xóa khỏi mục lục' })).toBeInTheDocument();
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

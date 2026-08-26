import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EvaluationDashboard from '../../src/features/expert-training/components/EvaluationDashboard';
import StatusLabel from '../../src/components/common/StatusLabel';
import ChapterCoveragePanel from '../../src/features/expert-training/components/ChapterCoveragePanel';
import ChapterPreviewDrawer from '../../src/features/expert-training/components/ChapterPreviewDrawer';
import ContributionWorkspace from '../../src/features/expert-training/components/ContributionWorkspace';
import ExpertTaskBoard from '../../src/features/expert-training/components/ExpertTaskBoard';
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
        materialPreview={null}
        materialLoading={false}
        materialError=""
        onOpenMaterial={vi.fn()}
      />,
    );

    expect(screen.getByText('Task này không thuộc về bạn')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thêm câu hỏi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lưu vào danh sách' })).not.toBeInTheDocument();
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

  it('lets the teacher start an extra question on the same chapter task', () => {
    render(
      <ContributionWorkspace
        selectedTask={{
          id: 'task-multi',
          type: 'GOLD_QA',
          status: 'IN_PROGRESS',
          assigneeId: 'teacher-1',
          chapter: 'Chapter 1: Introducing Java Platform, Enterprise Edition',
          title: 'Q&A vàng',
        }}
        userId="teacher-1"
        pendingAction=""
        onSubmitGoldQa={vi.fn()}
        onExamGoldQa={vi.fn()}
        onExamAllDrafts={vi.fn()}
        onSendForReview={vi.fn()}
        contributions={[
          {
            id: 'g1',
            question: 'Servlet lifecycle gồm gì?',
            goldAnswer: 'init, service, destroy',
            status: 'EXAMINED',
            examPassed: true,
            examScore: 0.8,
            examUsedTeachingNote: true,
          },
        ]}
        materialPreview={null}
        materialLoading={false}
        materialError=""
        onOpenMaterial={vi.fn()}
        onDeleteGoldQa={vi.fn()}
      />,
    );

    expect(screen.getByText('Servlet lifecycle gồm gì?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cho AI đánh giá lại' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi Senior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xóa' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm câu hỏi' }));
    expect(screen.getByText('Thêm câu hỏi #2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cho AI đánh giá' })).toBeInTheDocument();
    expect(screen.getByLabelText('Câu hỏi (theo chương giáo trình)')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sửa' }));
    expect(screen.getByText('Sửa câu hỏi #1')).toBeInTheDocument();
    expect(screen.getByLabelText('Câu hỏi (theo chương giáo trình)')).toHaveValue('Servlet lifecycle gồm gì?');
    expect(screen.getByLabelText('Tóm tắt ý chính từ giáo trình')).toHaveValue('init, service, destroy');
    expect(screen.queryByRole('button', { name: 'Cho AI đánh giá lại' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cập nhật danh sách' })).toBeInTheDocument();
  });

  it('shows baseline retake label before teaching-note exam', () => {
    render(
      <ContributionWorkspace
        selectedTask={{
          id: 'task-baseline',
          type: 'GOLD_QA',
          status: 'IN_PROGRESS',
          assigneeId: 'teacher-1',
          chapter: 'Servlet',
          title: 'Q&A vàng',
        }}
        userId="teacher-1"
        pendingAction=""
        onSubmitGoldQa={vi.fn()}
        onExamGoldQa={vi.fn()}
        onSendForReview={vi.fn()}
        onDeleteGoldQa={vi.fn()}
        contributions={[
          {
            id: 'b1',
            question: 'Filter chain là gì?',
            goldAnswer: '- Filter chạy trước Servlet',
            status: 'BASELINE_EXAMINED',
            examScore: 0.4,
            examUsedTeachingNote: false,
          },
        ]}
        materialPreview={null}
        materialLoading={false}
        materialError=""
        onOpenMaterial={vi.fn()}
      />,
    );

    expect(screen.getByText('AI trả lời · chưa gắn ý GV')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cho AI đánh giá lại (gộp ý GV)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gửi Senior' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xóa' })).toBeInTheDocument();
  });

  it('shows draft list actions for AI grading and retake', () => {
    const onExamGoldQa = vi.fn();
    const onExamAllDrafts = vi.fn();
    render(
      <ContributionWorkspace
        selectedTask={{
          id: 'task-drafts',
          type: 'GOLD_QA',
          status: 'IN_PROGRESS',
          assigneeId: 'teacher-1',
          chapter: 'Servlet',
          title: 'Q&A vàng',
        }}
        userId="teacher-1"
        pendingAction=""
        onSubmitGoldQa={vi.fn()}
        onExamGoldQa={onExamGoldQa}
        onExamAllDrafts={onExamAllDrafts}
        contributions={[
          {
            id: 'd1',
            question: 'Filter chain là gì?',
            goldAnswer: '- Filter chạy trước Servlet',
            status: 'DRAFT',
          },
          {
            id: 'd2',
            question: 'Listener dùng khi nào?',
            goldAnswer: '- Theo dõi lifecycle',
            status: 'DRAFT',
          },
        ]}
        materialPreview={null}
        materialLoading={false}
        materialError=""
        onOpenMaterial={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Cho AI đánh giá 2 câu nháp' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cho AI đánh giá 2 câu nháp' }));
    expect(onExamAllDrafts).toHaveBeenCalledWith(['d1', 'd2']);
    fireEvent.click(screen.getAllByRole('button', { name: 'Cho AI đánh giá' })[0]);
    expect(onExamGoldQa).toHaveBeenCalledWith('d1');
  });

  it('keeps typed Gold Q&A text when the same task refreshes', () => {
    const task = {
      id: 'task-keep-draft',
      type: 'GOLD_QA',
      status: 'IN_PROGRESS',
      assigneeId: 'teacher-1',
      chapter: 'A Note about JSP Documents (JSPX)',
      title: 'Q&A vàng 1/2',
    };
    const { rerender } = render(
      <ContributionWorkspace
        selectedTask={task}
        userId="teacher-1"
        pendingAction=""
        onSubmitGoldQa={vi.fn()}
        materialPreview={null}
        materialLoading={false}
        materialError=""
        contribution={null}
        rejection={null}
        onOpenMaterial={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Câu hỏi (theo chương giáo trình)'), {
      target: { value: 'JSPX khác JSP ở điểm nào?' },
    });
    fireEvent.change(screen.getByLabelText('Tóm tắt ý chính từ giáo trình'), {
      target: { value: 'JSPX dùng cú pháp XML.' },
    });

    rerender(
      <ContributionWorkspace
        selectedTask={{ ...task }}
        userId="teacher-1"
        pendingAction=""
        onSubmitGoldQa={vi.fn()}
        materialPreview={null}
        materialLoading={false}
        materialError=""
        contribution={null}
        rejection={null}
        onOpenMaterial={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Cho AI đánh giá' })).toBeInTheDocument();
    expect(screen.getByLabelText('Câu hỏi (theo chương giáo trình)')).toHaveValue('JSPX khác JSP ở điểm nào?');
    expect(screen.getByLabelText('Tóm tắt ý chính từ giáo trình')).toHaveValue('JSPX dùng cú pháp XML.');
  });

  it('keeps the Teacher editor on the Senior GOLD_QA flow only', () => {
    render(
      <ContributionWorkspace
        selectedTask={{
          id: 'rubric-task-1',
          type: 'RUBRIC',
          status: 'ASSIGNED',
          assigneeId: 'teacher-1',
          chapter: 'Collections',
          title: 'Legacy Rubric task',
        }}
        userId="teacher-1"
        pendingAction=""
        onSubmitGoldQa={vi.fn()}
        materialPreview={null}
        materialLoading={false}
        materialError=""
        contribution={null}
        onOpenMaterial={vi.fn()}
      />,
    );

    expect(screen.getByText('Task không thuộc flow GOLD_QA')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thêm câu hỏi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lưu vào danh sách' })).not.toBeInTheDocument();
    expect(screen.queryByText('Rubric chất lượng câu trả lời')).not.toBeInTheDocument();
  });

  it('shows only GOLD_QA tasks and mirrors the exam state visible to Senior', () => {
    render(
      <ExpertTaskBoard
        tasks={[
          {
            id: 'gold-task-1',
            type: 'GOLD_QA',
            status: 'IN_PROGRESS',
            assigneeId: 'teacher-1',
            chapter: 'Recursion',
            title: 'Q&A vàng 1/2 · Recursion',
            priority: 70,
          },
          {
            id: 'rubric-task-1',
            type: 'RUBRIC',
            status: 'OPEN',
            chapter: 'Recursion',
            title: 'Legacy Rubric task',
          },
        ]}
        goldQa={[{
          id: 'gold-1',
          sourceTaskId: 'gold-task-1',
          status: 'EXAMINED',
          question: 'What is recursion?',
          goldAnswer: 'Recursion is a function that calls itself.',
          examAiAnswer: 'A function that calls itself until a base case.',
          examPassed: true,
          examScore: 0.82,
        }]}
        userId="teacher-1"
        loading={false}
        error=""
        pendingAction=""
        onRefresh={vi.fn()}
        onClaim={vi.fn()}
        onContribute={vi.fn()}
        onPreviewTask={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText(/Việc của tôi/));
    expect(screen.getByText('Q&A vàng 1/2 · Recursion')).toBeInTheDocument();
    expect(screen.getByText('Xem trước: phủ 82% ý giáo trình')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả chấm' }));
    expect(screen.getByText('Ý chính giáo viên')).toBeInTheDocument();
    expect(screen.getByText('Câu trả lời AI (chưa gắn ý GV)')).toBeInTheDocument();
    expect(screen.getByText('Recursion is a function that calls itself.')).toBeInTheDocument();
    expect(screen.getByText('A function that calls itself until a base case.')).toBeInTheDocument();
    expect(screen.queryByText('Legacy Rubric task')).not.toBeInTheDocument();
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

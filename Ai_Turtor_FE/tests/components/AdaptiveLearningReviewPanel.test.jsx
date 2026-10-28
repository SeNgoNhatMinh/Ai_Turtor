import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdaptiveLearningReviewPanel from '../../src/features/teacher/review/AdaptiveLearningReviewPanel';
import { teacherReviewApi } from '../../src/services/teacherReviewApi';

vi.mock('../../src/services/teacherReviewApi', () => ({
  teacherReviewApi: {
    getAdaptiveLearningReviews: vi.fn(),
    getAdaptiveStudentRoster: vi.fn(),
    decideAdaptiveLearningReview: vi.fn(),
    getStudentCourseSummary: vi.fn(),
  },
}));

const labeledStudent = {
  studentId: 'student-1',
  studentName: 'Nguyen Van A',
  courseId: 'PRO192',
  classId: 'SE1833',
  totalQuestions: 10,
  questionsInCurrentCycle: 0,
  cycleSize: 10,
  labeled: true,
  latestReviewId: 'rev-1',
  reviewStatus: 'PENDING',
  currentSupportLevel: 'STANDARD',
  suggestedSupportLevel: 'CHALLENGE',
  overallPercent: 88,
  reviewQuestionCount: 10,
  reviewCreatedAt: '2026-10-20T09:30:00',
};

const unlabeledStudent = {
  studentId: 'student-2',
  studentName: 'Tran Thi B',
  courseId: 'PRO192',
  classId: 'SE1833',
  totalQuestions: 3,
  questionsInCurrentCycle: 3,
  cycleSize: 5,
  labeled: false,
  latestReviewId: null,
  reviewStatus: null,
  currentSupportLevel: 'STANDARD',
  suggestedSupportLevel: null,
  overallPercent: 0,
  reviewQuestionCount: null,
  reviewCreatedAt: null,
};

vi.mock('../../src/features/realtime/realtimeContext', () => ({
  useRealtimeEvent: vi.fn(),
}));

const pendingReview = {
  id: 'rev-1',
  studentId: 'student-1',
  studentName: 'Nguyen Van A',
  courseId: 'PRO192',
  classId: 'SE1833',
  questionCount: 10,
  completedSessionCount: 10,
  status: 'PENDING',
  currentSupportLevel: 'STANDARD',
  suggestedSupportLevel: 'CHALLENGE',
  overallPercent: 88,
  knowledgePercent: 85,
  practicePercent: 82,
  independencePercent: 90,
  confidencePercent: 100,
  summary: 'Sinh viên hiểu tốt OOP và tự làm được bài tập.',
  strengths: ['Nắm vững đóng gói'],
  knowledgeGaps: ['Đa hình'],
  teachingRecommendations: ['Cho bài tập nâng cao'],
  evidence: [
    {
      messageId: 'm-1',
      sessionId: 'session-1',
      role: 'STUDENT',
      content: 'Em đã tự viết lớp Student có thuộc tính private và getter.',
      topic: 'OOP',
      createdAt: '2026-10-20T09:00:00',
    },
  ],
  createdAt: '2026-10-20T09:30:00',
};

const renderPanel = (triggerToast = vi.fn()) => render(
  <AdaptiveLearningReviewPanel courseId="PRO192" classId="SE1833" triggerToast={triggerToast} />,
);

describe('AdaptiveLearningReviewPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the pending review with scores, suggestion and evidence', async () => {
    teacherReviewApi.getAdaptiveLearningReviews.mockResolvedValue([pendingReview]);
    teacherReviewApi.getAdaptiveStudentRoster.mockResolvedValue([labeledStudent]);

    renderPanel();

    expect((await screen.findAllByText('Nguyen Van A')).length).toBeGreaterThan(0);
    expect(screen.getByText(/Sau 10 câu hỏi/)).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('Thử thách')).toBeInTheDocument();
    expect(screen.getByText('Sinh viên hiểu tốt OOP và tự làm được bài tập.')).toBeInTheDocument();
    expect(screen.getByText(/1 mục · \d+ câu trả lời sai/)).toBeInTheDocument();
    expect(teacherReviewApi.getAdaptiveLearningReviews).toHaveBeenCalledWith(
      'PRO192', 'SE1833', expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('shows the empty state when the class has no students yet', async () => {
    teacherReviewApi.getAdaptiveLearningReviews.mockResolvedValue([]);
    teacherReviewApi.getAdaptiveStudentRoster.mockResolvedValue([]);

    renderPanel();

    expect(await screen.findByText('Lớp chưa có sinh viên')).toBeInTheDocument();
  });

  it('shows unlabeled students with zero percent and cycle progress', async () => {
    teacherReviewApi.getAdaptiveLearningReviews.mockResolvedValue([]);
    teacherReviewApi.getAdaptiveStudentRoster.mockResolvedValue([unlabeledStudent]);

    renderPanel();

    expect((await screen.findAllByText('Tran Thi B')).length).toBeGreaterThan(0);
    expect(screen.getByText(/Đã hỏi 3\/5 câu tới chu kỳ đánh giá · 0%/)).toBeInTheDocument();
    expect(screen.getAllByText('Chưa đánh giá').length).toBeGreaterThan(0);
    expect(screen.getByText('AI đánh giá sau mỗi 5 câu hỏi, hoặc sớm hơn khi sai lặp lại hay làm đúng liên tục')).toBeInTheDocument();
  });

  it('requires teacher feedback before approving', async () => {
    teacherReviewApi.getAdaptiveLearningReviews.mockResolvedValue([pendingReview]);
    teacherReviewApi.getAdaptiveStudentRoster.mockResolvedValue([labeledStudent]);
    const triggerToast = vi.fn();

    renderPanel(triggerToast);
    await screen.findAllByText('Nguyen Van A');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nhận xét và quyết định' }));

    expect(teacherReviewApi.decideAdaptiveLearningReview).not.toHaveBeenCalled();
    expect(triggerToast).toHaveBeenCalledWith(
      'Hãy nhập nhận xét hoặc chỉ dẫn giảng dạy trước khi duyệt.',
    );
  });

  it('submits the approve decision with feedback and suggested level', async () => {
    teacherReviewApi.getAdaptiveLearningReviews.mockResolvedValue([pendingReview]);
    teacherReviewApi.getAdaptiveStudentRoster.mockResolvedValue([labeledStudent]);
    teacherReviewApi.decideAdaptiveLearningReview.mockResolvedValue({
      ...pendingReview,
      status: 'APPROVED',
      teacherFeedback: 'Tiếp tục thử thách với bài tập đa hình.',
    });
    const triggerToast = vi.fn();

    renderPanel(triggerToast);
    await screen.findAllByText('Nguyen Van A');
    fireEvent.change(
      screen.getByPlaceholderText('Nhập nhận xét, hướng dẫn cách giảng hoặc mục tiêu cần ưu tiên...'),
      { target: { value: 'Tiếp tục thử thách với bài tập đa hình.' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nhận xét và quyết định' }));

    await waitFor(() => expect(teacherReviewApi.decideAdaptiveLearningReview).toHaveBeenCalledWith(
      'rev-1',
      {
        decision: 'APPROVE',
        teacherFeedback: 'Tiếp tục thử thách với bài tập đa hình.',
        supportLevel: 'CHALLENGE',
      },
    ));
    await waitFor(() => expect(triggerToast).toHaveBeenCalledWith(
      'Đã lưu quyết định và nhận xét của giảng viên.',
    ));
  });

  it('embedded mode shows only the forced student review without header or roster', async () => {
    teacherReviewApi.getAdaptiveLearningReviews.mockResolvedValue([pendingReview]);
    teacherReviewApi.getAdaptiveStudentRoster.mockResolvedValue([labeledStudent, unlabeledStudent]);

    render(
      <AdaptiveLearningReviewPanel
        embedded
        forcedStudentId="student-1"
        courseId="PRO192"
        classId="SE1833"
        triggerToast={vi.fn()}
      />,
    );

    expect((await screen.findAllByText('Nguyen Van A')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Sinh viên trong lớp')).not.toBeInTheDocument();
    expect(screen.queryByText('Tran Thi B')).not.toBeInTheDocument();
    expect(screen.getByText('Sinh viên hiểu tốt OOP và tự làm được bài tập.')).toBeInTheDocument();
  });

  it('generates the whole-history AI course summary with quiz stats and skipped count', async () => {
    teacherReviewApi.getAdaptiveLearningReviews.mockResolvedValue([pendingReview]);
    teacherReviewApi.getAdaptiveStudentRoster.mockResolvedValue([labeledStudent]);
    teacherReviewApi.getStudentCourseSummary.mockResolvedValue({
      studentId: 'student-1',
      courseId: 'PRO192',
      classId: 'SE1833',
      totalQuestions: 93,
      questionsInCurrentCycle: 3,
      cycleSize: 10,
      quizGiven: 30,
      quizAnswered: 25,
      quizCorrect: 18,
      quizWrong: 7,
      quizSkipped: 5,
      quizCorrectPercent: 72,
      currentSupportLevel: 'HIGH_SUPPORT',
      aiSummary: 'Sinh viên hỏi nhiều về OOP, gần đây tiến bộ rõ ở đa hình.',
      strengths: ['Tự viết được ví dụ đóng gói'],
      knowledgeGaps: ['Đa hình'],
      teachingRecommendations: ['Cho bài tập đa hình nhỏ'],
      difficultConcepts: [{ concept: 'Đa hình là gì?', wrongCount: 3, skippedCount: 1 }],
      levelHistory: [{
        reviewId: 'rev-1', questionCount: 90, triggerType: 'CYCLE_10',
        fromLevel: 'STANDARD', toLevel: 'HIGH_SUPPORT', status: 'PENDING',
        createdAt: '2026-10-20T09:30:00',
      }],
      modelGenerated: true,
    });

    renderPanel();
    await screen.findAllByText('Nguyen Van A');
    fireEvent.click(screen.getByRole('button', { name: 'AI tóm tắt toàn bộ lịch sử' }));

    expect(await screen.findByText(/Sinh viên hỏi nhiều về OOP/)).toBeInTheDocument();
    expect(screen.getByText(/câu kiểm tra bỏ qua/)).toBeInTheDocument();
    expect(screen.getByText(/Sau 90 câu hỏi/)).toBeInTheDocument();
    expect(teacherReviewApi.getStudentCourseSummary).toHaveBeenCalledWith(
      'student-1', 'PRO192', 'SE1833', expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('asks for course and class when they are not selected', () => {
    render(<AdaptiveLearningReviewPanel courseId="" classId="" triggerToast={vi.fn()} />);

    expect(screen.getByText('Chọn môn học và lớp')).toBeInTheDocument();
    expect(teacherReviewApi.getAdaptiveLearningReviews).not.toHaveBeenCalled();
  });
});

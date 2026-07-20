import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TeacherGradingTab from '../../src/pages/teacher/TeacherGradingTab';

const attempt = {
  id: 'session-1',
  quizSessionId: 'session-1',
  studentName: 'Nguyen Van A',
  title: 'OOP Review',
  submittedAt: '2026-07-18T08:00:00Z',
  status: 'SUBMITTED',
  teacherReviewStatus: 'PENDING',
  autoScore: 0,
  score: 0,
  maxScore: 1,
  questions: [{
    questionId: 'q-1',
    questionText: 'What is encapsulation?',
    options: ['Hiding implementation details', 'Creating many classes'],
    correctAnswer: 'Hiding implementation details',
    explanation: 'Encapsulation protects internal state.',
  }],
  answers: [{
    questionId: 'q-1',
    selectedAnswer: 'Creating many classes',
    correctAnswer: 'Hiding implementation details',
    correct: false,
  }],
};

const renderGrading = (selectedTeacherSub, overrides = {}) => render(
  <TeacherGradingTab
    quizSubmissions={[selectedTeacherSub]}
    selectedTeacherSub={selectedTeacherSub}
    setSelectedTeacherSub={vi.fn()}
    onSelectSubmission={vi.fn()}
    teacherGradeScore={selectedTeacherSub.teacherReviewedScore ?? selectedTeacherSub.autoScore}
    setTeacherGradeScore={vi.fn()}
    teacherGradeFeedback={selectedTeacherSub.teacherFeedback || ''}
    setTeacherGradeFeedback={vi.fn()}
    teacherGradeWeakTopics={[]}
    setTeacherGradeWeakTopics={vi.fn()}
    onGradeSubmit={vi.fn()}
    handleTeacherQuizReview={vi.fn()}
    handleDownloadSubmission={vi.fn()}
    {...overrides}
  />,
);

describe('TeacherGradingTab quiz review', () => {
  it('shows the backend auto score, student choice, and published correct answer', () => {
    renderGrading(attempt);
    fireEvent.click(screen.getByText('Quiz trực tuyến'));

    expect(screen.getByText('Điểm backend: 0 / 1')).toBeVisible();
    expect(screen.getByText('Creating many classes')).toBeVisible();
    expect(screen.getByText('Sinh viên đã chọn')).toBeVisible();
    expect(screen.getByText('Đáp án đúng')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Xác nhận điểm cuối' })).toBeVisible();
  });

  it('renders an already reviewed attempt as read only', () => {
    renderGrading({
      ...attempt,
      teacherReviewStatus: 'REVIEWED',
      teacherReviewedScore: 1,
      finalScore: 1,
      teacherFeedback: 'Accepted after manual review.',
      teacherReviewedAt: '2026-07-18T09:00:00Z',
    });
    fireEvent.click(screen.getByText('Quiz trực tuyến'));

    expect(screen.getAllByText(/Điểm cuối: 1 \/ 1/).length).toBeGreaterThan(0);
    expect(screen.getByText('Giảng viên đã hoàn tất duyệt điểm')).toBeVisible();
    expect(screen.getByText(/Accepted after manual review/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Xác nhận điểm cuối' })).not.toBeInTheDocument();
  });

  it('locks the final review controls while the mutation is pending', () => {
    renderGrading(attempt, {
      gradingMutationKeys: ['quiz-review:session-1'],
    });
    fireEvent.click(screen.getByText('Quiz trực tuyến'));

    expect(screen.getByRole('button', { name: 'Đang lưu kết quả...' })).toBeDisabled();
    expect(screen.getByLabelText('Điểm cuối')).toBeDisabled();
    expect(screen.getByLabelText('Nhận xét của giảng viên')).toBeDisabled();
  });
});

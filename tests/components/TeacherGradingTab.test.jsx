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
    fireEvent.click(screen.getByText('Online Quizzes'));

    expect(screen.getByText('Auto score: 0 / 1')).toBeVisible();
    expect(screen.getByText('Creating many classes')).toBeVisible();
    expect(screen.getByText('Student choice')).toBeVisible();
    expect(screen.getByText('Correct answer')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Submit Final Review' })).toBeVisible();
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
    fireEvent.click(screen.getByText('Online Quizzes'));

    expect(screen.getByText('Final score: 1 / 1')).toBeVisible();
    expect(screen.getByText('Teacher review completed')).toBeVisible();
    expect(screen.getByText(/Accepted after manual review/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Submit Final Review' })).not.toBeInTheDocument();
  });

  it('locks the final review controls while the mutation is pending', () => {
    renderGrading(attempt, {
      gradingMutationKeys: ['quiz-review:session-1'],
    });
    fireEvent.click(screen.getByText('Online Quizzes'));

    expect(screen.getByRole('button', { name: 'Submitting final review...' })).toBeDisabled();
    expect(screen.getByLabelText('Final score')).toBeDisabled();
    expect(screen.getByLabelText('Teacher feedback')).toBeDisabled();
  });
});

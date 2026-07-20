import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuizResult from '../../src/pages/student/QuizResult';

vi.mock('../../src/components/AiAnswer', () => ({
  default: ({ markdown }) => <div>{markdown}</div>,
}));

const submittedResult = {
  status: 'SUBMITTED',
  quizType: 'SELF_PRACTICE',
  topic: 'Object-Oriented Programming',
  score: 0,
  maxScore: 1,
  questions: [{
    questionId: 'q1',
    questionText: 'Which concept supports code reuse?',
    options: ['Encapsulation', 'Inheritance', 'Polymorphism', 'Abstraction'],
    correctAnswer: 'Inheritance',
  }],
  answers: [{
    questionId: 'q1',
    selectedAnswer: 'Encapsulation',
    correct: false,
    correctAnswer: 'Inheritance',
    explanation: 'Inheritance allows a class to reuse behavior from a parent class.',
  }],
};

describe('QuizResult', () => {
  it('shows every option plus the student choice and correct answer after submission', () => {
    render(<QuizResult result={submittedResult} />);

    const choices = screen.getByRole('list', { name: 'Các lựa chọn của câu 1' });
    expect(within(choices).getAllByRole('listitem')).toHaveLength(4);
    expect(within(choices).getByText('Encapsulation')).toBeVisible();
    expect(within(choices).getByText('Inheritance')).toBeVisible();
    expect(within(choices).getByText('Polymorphism')).toBeVisible();
    expect(within(choices).getByText('Abstraction')).toBeVisible();
    expect(within(choices).getByText('Bạn đã chọn')).toBeVisible();
    expect(within(choices).getByText('Đáp án đúng')).toBeVisible();
    expect(screen.getByText('Sai')).toBeVisible();
  });
});

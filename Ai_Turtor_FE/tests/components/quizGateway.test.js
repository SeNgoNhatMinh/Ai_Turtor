import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/n8nClient', () => ({
  N8N_ENABLED: true,
  N8N_QUIZ_ENABLED: true,
  N8N_STRICT: true,
}));

vi.mock('../../src/services/n8nService', () => ({
  n8nService: {
    generateQuiz: vi.fn(),
    submitQuiz: vi.fn(),
  },
}));

vi.mock('../../src/services/quizApi', () => ({
  quizApi: {
    generateSelfQuiz: vi.fn(),
    submitQuiz: vi.fn(),
    getQuiz: vi.fn(),
  },
}));

import { quizGateway } from '../../src/features/ai-harness/quizGateway';
import { n8nService } from '../../src/services/n8nService';
import { quizApi } from '../../src/services/quizApi';

describe('quiz n8n gateway', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the canonical quiz after n8n creates a session summary', async () => {
    n8nService.generateQuiz.mockResolvedValue({
      success: true,
      status: 'GENERATED',
      quizSessionId: 'quiz-1',
    });
    quizApi.getQuiz.mockResolvedValue({
      quizSessionId: 'quiz-1',
      status: 'GENERATED',
      title: 'OOP practice',
      questions: [{ questionId: 'question-1', prompt: 'OOP là gì?' }],
    });

    const quiz = await quizGateway.generateStudentQuiz({
      studentId: 'student-1',
      courseId: 'PRO192',
      classId: 'SE1833',
      payload: { topic: 'OOP', questionCount: 3 },
    });

    expect(n8nService.generateQuiz).toHaveBeenCalledWith(expect.objectContaining({
      route: 'STUDENT',
      studentId: 'student-1',
      courseId: 'PRO192',
      classId: 'SE1833',
      questionCount: 3,
    }));
    expect(quizApi.getQuiz).toHaveBeenCalledWith('quiz-1');
    expect(quiz.questions).toHaveLength(1);
    expect(quizApi.generateSelfQuiz).not.toHaveBeenCalled();
  });

  it('loads the canonical result after n8n submits a self-practice quiz', async () => {
    n8nService.submitQuiz.mockResolvedValue({
      success: true,
      status: 'SUBMITTED',
      quizSessionId: 'quiz-1',
    });
    quizApi.getQuiz.mockResolvedValue({
      quizSessionId: 'quiz-1',
      status: 'SUBMITTED',
      score: 1,
      questions: [{ questionId: 'question-1' }],
      answers: [{ questionId: 'question-1', selectedAnswer: 'Đúng' }],
    });

    const result = await quizGateway.submitStudentQuiz({
      quizSessionId: 'quiz-1',
      studentId: 'student-1',
      courseId: 'PRO192',
      classId: 'SE1833',
      payload: { answers: [{ questionId: 'question-1', selectedAnswer: 'Đúng' }] },
    });

    expect(quizApi.getQuiz).toHaveBeenCalledWith('quiz-1');
    expect(result.answers[0].selectedAnswer).toBe('Đúng');
    expect(result.score).toBe(1);
    expect(quizApi.submitQuiz).not.toHaveBeenCalled();
  });
});

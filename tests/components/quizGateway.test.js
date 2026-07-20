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
    generateTeacherQuizDraft: vi.fn(),
    submitQuiz: vi.fn(),
    getQuiz: vi.fn(),
    getTeacherQuizAssignments: vi.fn(),
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

    expect(quizApi.getQuiz).toHaveBeenCalledWith('quiz-1');
    expect(quiz.questions).toHaveLength(1);
    expect(quizApi.generateSelfQuiz).not.toHaveBeenCalled();
  });

  it('loads the canonical result after n8n submits an assigned quiz', async () => {
    n8nService.submitQuiz.mockResolvedValue({
      success: true,
      status: 'SUBMITTED_WAITING_TEACHER_REVIEW',
      quizSessionId: 'quiz-1',
    });
    quizApi.getQuiz.mockResolvedValue({
      quizSessionId: 'quiz-1',
      status: 'SUBMITTED',
      teacherReviewStatus: 'PENDING_REVIEW',
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
    expect(result.teacherReviewStatus).toBe('PENDING_REVIEW');
    expect(quizApi.submitQuiz).not.toHaveBeenCalled();
  });

  it('loads the canonical teacher draft when n8n returns only an assignment receipt', async () => {
    n8nService.generateQuiz.mockResolvedValue({
      success: true,
      status: 'DRAFT_CREATED',
      quizType: 'TEACHER_ASSIGNMENT',
      assignmentId: 'assignment-1',
    });
    quizApi.getTeacherQuizAssignments.mockResolvedValue([{
      assignmentId: 'assignment-1',
      title: 'OOP review',
      status: 'DRAFT',
      questions: [{ questionId: 'question-1', questionText: 'OOP là gì?' }],
    }]);

    const draft = await quizGateway.generateTeacherDraft({
      teacherId: 'teacher-1',
      teacherName: 'Teacher A',
      courseId: 'PRO192',
      classId: 'SE1833',
      payload: { title: 'OOP review', topic: 'OOP', questionCount: 3 },
    });

    expect(quizApi.getTeacherQuizAssignments).toHaveBeenCalledWith('teacher-1');
    expect(draft.assignmentId).toBe('assignment-1');
    expect(draft.questions).toHaveLength(1);
  });
});

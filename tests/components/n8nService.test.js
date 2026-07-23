import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/n8nClient', () => ({
  N8N_CHAT_TIMEOUT_MS: 180_000,
  N8N_QUIZ_TIMEOUT_MS: 240_000,
  N8N_ASSIGNMENT_GRADING_TIMEOUT_MS: 300_000,
  N8N_TUTOR_V2_FLOW_TIMEOUT_MS: 120_000,
  N8N_TUTOR_V2_APPROVAL_TIMEOUT_MS: 240_000,
  N8N_TUTOR_V2_EVALUATION_TIMEOUT_MS: 300_000,
  postN8n: vi.fn(),
}));

import { postN8n } from '../../src/services/n8nClient';
import { n8nService } from '../../src/services/n8nService';

describe('n8n education workflow service', () => {
  beforeEach(() => postN8n.mockReset());

  it('uses the active workflow paths documented by the backend project', async () => {
    postN8n.mockResolvedValue({
      success: true,
      mode: 'RAG_TUTOR',
      answer: 'Course answer',
      conversationId: 'conversation-1',
    });
    const chat = await n8nService.sendStudentChat({
      studentId: 'student-1',
      courseId: 'PRO192',
      classId: 'SE1833',
      message: 'OOP là gì?',
    });
    expect(chat.mode).toBe('RAG');
    expect(postN8n).toHaveBeenLastCalledWith('/student-chat', {
      studentId: 'student-1',
      courseId: 'PRO192',
      classId: 'SE1833',
      message: 'OOP là gì?',
    }, { timeoutMs: 180_000 });

    postN8n.mockResolvedValue({ success: true, status: 'SUBMITTED' });
    await n8nService.submitAnswerReview({ mode: 'RAG_TUTOR' });
    expect(postN8n).toHaveBeenLastCalledWith('/answer-review', { mode: 'RAG' }, {});

    postN8n.mockResolvedValue({ success: true, knowledgeCandidateCreated: false });
    await n8nService.submitTeacherAnswer({ questionEscalationId: 'ticket-1' });
    expect(postN8n).toHaveBeenLastCalledWith(
      '/teacher-answer-escalation',
      { questionEscalationId: 'ticket-1' },
      {},
    );

    postN8n.mockResolvedValue({ success: true, status: 'RESOLVED' });
    await n8nService.submitSeniorReviewResolution({ reviewId: 'review-1' });
    expect(postN8n).toHaveBeenLastCalledWith(
      '/senior-resolve-answer-review',
      { reviewId: 'review-1' },
      {},
    );

    postN8n.mockResolvedValue({ success: true, decision: 'APPROVE' });
    await n8nService.submitSeniorApproval({ candidateId: 'candidate-1', decision: 'APPROVE' });
    expect(postN8n).toHaveBeenLastCalledWith(
      '/senior-knowledge-approval',
      { candidateId: 'candidate-1', decision: 'APPROVE' },
      {},
    );
  });

  it('uses long-running quiz webhooks and keeps their business statuses', async () => {
    postN8n.mockResolvedValue({ success: true, status: 'GENERATED', quizSessionId: 'quiz-1' });
    const generated = await n8nService.generateQuiz({ studentId: 'student-1' });
    expect(generated.status).toBe('GENERATED');
    expect(postN8n).toHaveBeenLastCalledWith('/quiz-generate', { studentId: 'student-1' }, {
      timeoutMs: 240_000,
    });

    postN8n.mockResolvedValue({
      success: true,
      status: 'SUBMITTED_WAITING_TEACHER_REVIEW',
      quizSessionId: 'quiz-1',
    });
    const submitted = await n8nService.submitQuiz({ quizSessionId: 'quiz-1' });
    expect(submitted.status).toBe('SUBMITTED_WAITING_TEACHER_REVIEW');
    expect(postN8n).toHaveBeenLastCalledWith('/quiz-submit', { quizSessionId: 'quiz-1' }, {
      timeoutMs: 240_000,
    });
  });

  it('requires a confirmed assignment grading receipt', async () => {
    postN8n.mockResolvedValue({
      id: 'submission-1',
      aiGradingStatus: 'SUGGESTED',
      aiSuggestedScore: 8,
    });
    const result = await n8nService.gradeAssignmentSubmission({
      submissionId: 'submission-1',
      teacherId: 'teacher-1',
    });
    expect(result.aiSuggestedScore).toBe(8);
    expect(postN8n).toHaveBeenLastCalledWith('/teacher-assignment-ai-grade', {
      submissionId: 'submission-1',
      teacherId: 'teacher-1',
    }, { timeoutMs: 300_000 });

    postN8n.mockResolvedValue({ message: 'Backend request failed' });
    await expect(n8nService.gradeAssignmentSubmission({
      submissionId: 'submission-1',
      teacherId: 'teacher-1',
    })).rejects.toThrow(/invalid receipt/);
  });

  it('uses Tutor V2 webhook paths without placing JWT compatibility data in the body', async () => {
    postN8n.mockResolvedValue({ gaps: [] });
    await n8nService.analyzeTutorV2Coverage({ courseId: 'PRO192', chapters: ['OOP'] });
    expect(postN8n).toHaveBeenLastCalledWith('/v2-coverage-analyze', {
      courseId: 'PRO192',
      chapters: ['OOP'],
    }, {
      timeoutMs: 120_000,
      includeAuthTokenInBody: false,
    });

    postN8n.mockResolvedValue({ id: 'gold-1', status: 'PENDING_REVIEW' });
    await n8nService.submitTutorV2GoldQa({ question: 'What is OOP?' });
    expect(postN8n).toHaveBeenLastCalledWith('/v2-gold-qa-submit', {
      question: 'What is OOP?',
    }, {
      timeoutMs: 120_000,
      includeAuthTokenInBody: false,
    });

    postN8n.mockResolvedValue({ id: 'run-1', status: 'PASSED' });
    await n8nService.runTutorV2Evaluation({ courseId: 'PRO192' });
    expect(postN8n).toHaveBeenLastCalledWith('/v2-eval-run', {
      courseId: 'PRO192',
    }, {
      timeoutMs: 300_000,
      includeAuthTokenInBody: false,
    });
  });
});

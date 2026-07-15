import {
  N8N_ENABLED,
  N8N_QUIZ_ENABLED,
  N8N_STRICT,
} from '../../services/n8nClient';
import { n8nService } from '../../services/n8nService';
import { normalizeQuizAssignment, normalizeQuizSession } from '../../services/normalizers';
import { quizApi } from '../../services/quizApi';

const isQuizHarnessEnabled = () => N8N_ENABLED && N8N_QUIZ_ENABLED;

const getQuizSession = (response) => (
  response?.quizSession || response?.quiz || response?.result || response
);

const getQuizAssignment = (response) => (
  response?.quizAssignment || response?.assignment || response?.draft || response
);

async function withLocalFallback(harnessAction, backendAction, warning) {
  if (!isQuizHarnessEnabled()) return backendAction();
  try {
    return await harnessAction();
  } catch (error) {
    if (N8N_STRICT) throw error;
    console.warn(warning, error);
    return backendAction();
  }
}

export const quizGateway = {
  async generateStudentQuiz({ studentId, courseId, classId, payload }) {
    return withLocalFallback(
      async () => normalizeQuizSession(getQuizSession(await n8nService.generateQuiz({
        route: 'STUDENT',
        quizType: 'SELF_PRACTICE',
        studentId,
        courseId,
        classId,
        ...payload,
      }))),
      () => quizApi.generateSelfQuiz(studentId, courseId, { classId, ...payload }),
      'n8n student quiz generation failed, using backend-direct local fallback:',
    );
  },

  async generateTeacherDraft({ teacherId, teacherName, courseId, classId, payload }) {
    return withLocalFallback(
      async () => normalizeQuizAssignment(getQuizAssignment(await n8nService.generateQuiz({
        route: 'TEACHER',
        quizType: 'TEACHER_ASSIGNMENT',
        teacherId,
        teacherName,
        courseId,
        classId,
        ...payload,
      }))),
      () => quizApi.generateTeacherQuizDraft(teacherId, courseId, { classId, ...payload }),
      'n8n teacher quiz generation failed, using backend-direct local fallback:',
    );
  },

  async submitStudentQuiz({ quizSessionId, studentId, courseId, classId, payload }) {
    return withLocalFallback(
      async () => normalizeQuizSession(getQuizSession(await n8nService.submitQuiz({
        route: 'STUDENT',
        quizSessionId,
        studentId,
        courseId,
        classId,
        ...payload,
      }))),
      () => quizApi.submitQuiz(quizSessionId, payload),
      'n8n quiz submission failed, using backend-direct local fallback:',
    );
  },
};

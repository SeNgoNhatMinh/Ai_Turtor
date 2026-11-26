import {
  N8N_ENABLED,
  N8N_QUIZ_ENABLED,
  N8N_STRICT,
} from '../../services/n8nClient';
import { n8nService } from '../../services/n8nService';
import { normalizeQuizSession } from '../../services/normalizers';
import { quizApi } from '../../services/quizApi';
import { assertGeneratedQuizContext } from './quizContext';

const isQuizHarnessEnabled = () => N8N_ENABLED && N8N_QUIZ_ENABLED;

const getQuizSession = (response) => (
  response?.quizSession || response?.quiz || response?.result || response
);

async function hydrateQuizSession(response, warning) {
  const summary = normalizeQuizSession(getQuizSession(response));
  const quizSessionId = summary.quizSessionId || summary.id;
  if (!quizSessionId) return summary;

  try {
    const detail = await quizApi.getQuiz(quizSessionId);
    return normalizeQuizSession({
      ...summary,
      ...detail,
      status: detail?.status || summary.status,
      teacherReviewStatus: detail?.teacherReviewStatus || summary.teacherReviewStatus,
    });
  } catch (error) {
    // The n8n mutation already succeeded. Never repeat it just because the canonical read is delayed.
    console.warn(warning, error);
    return summary;
  }
}

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
    const quiz = await withLocalFallback(
      async () => hydrateQuizSession(
        await n8nService.generateQuiz({
          route: 'STUDENT',
          quizType: 'SELF_PRACTICE',
          studentId,
          courseId,
          classId,
          ...payload,
        }),
        'Quiz was generated, but its full detail is not available yet:',
      ),
      () => quizApi.generateSelfQuiz(studentId, courseId, { classId, ...payload }),
      'n8n student quiz generation failed, using backend-direct local fallback:',
    );
    return assertGeneratedQuizContext(quiz, { courseId, classId });
  },

  async submitStudentQuiz({ quizSessionId, studentId, courseId, classId, payload }) {
    return withLocalFallback(
      async () => hydrateQuizSession(
        await n8nService.submitQuiz({
          route: 'STUDENT',
          quizSessionId,
          studentId,
          courseId,
          classId,
          ...payload,
        }),
        'Quiz was submitted, but its full result is not available yet:',
      ),
      () => quizApi.submitQuiz(quizSessionId, payload),
      'n8n quiz submission failed, using backend-direct local fallback:',
    );
  },
};

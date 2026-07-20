import {
  N8N_ENABLED,
  N8N_QUIZ_ENABLED,
  N8N_STRICT,
} from '../../services/n8nClient';
import { n8nService } from '../../services/n8nService';
import { normalizeQuizAssignment, normalizeQuizSession } from '../../services/normalizers';
import { quizApi } from '../../services/quizApi';
import { assertGeneratedQuizContext } from './quizContext';

const isQuizHarnessEnabled = () => N8N_ENABLED && N8N_QUIZ_ENABLED;

const getQuizSession = (response) => (
  response?.quizSession || response?.quiz || response?.result || response
);

const getQuizAssignment = (response) => (
  response?.quizAssignment || response?.assignment || response?.draft || response
);

const wait = (durationMs) => new Promise((resolve) => {
  window.setTimeout(resolve, durationMs);
});

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

async function hydrateTeacherAssignment(response, teacherId) {
  const summary = normalizeQuizAssignment(getQuizAssignment(response));
  const assignmentId = summary.assignmentId || summary.id;
  if (!assignmentId || summary.questions.length > 0) return summary;

  // n8n may intentionally return only a mutation receipt. Read the canonical
  // assignment from Spring Boot instead of repeating the generate mutation.
  for (const delayMs of [0, 300, 700]) {
    if (delayMs) await wait(delayMs);
    try {
      const assignments = await quizApi.getTeacherQuizAssignments(teacherId);
      const assignment = assignments.find((item) => (
        String(item?.assignmentId || item?.id) === String(assignmentId)
      ));
      if (assignment) {
        return normalizeQuizAssignment({ ...summary, ...assignment });
      }
    } catch (error) {
      console.warn('Quiz draft was created, but its canonical detail is not available yet:', error);
    }
  }

  return summary;
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

  async generateTeacherDraft({ teacherId, teacherName, courseId, classId, payload }) {
    const assignment = await withLocalFallback(
      async () => hydrateTeacherAssignment(
        await n8nService.generateQuiz({
          route: 'TEACHER',
          quizType: 'TEACHER_ASSIGNMENT',
          teacherId,
          teacherName,
          courseId,
          classId,
          ...payload,
        }),
        teacherId,
      ),
      () => quizApi.generateTeacherQuizDraft(teacherId, courseId, { classId, ...payload }),
      'n8n teacher quiz generation failed, using backend-direct local fallback:',
    );
    return assertGeneratedQuizContext(assignment, { courseId, classId });
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

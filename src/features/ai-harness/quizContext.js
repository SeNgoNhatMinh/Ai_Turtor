import { classIdMatches } from '../../utils/academicIds.js';

const normalizeCourseId = (value) => String(value || '').trim().toUpperCase();

const createContextError = ({ message, userMessage, code, details }) => Object.assign(
  new Error(userMessage),
  { name: 'QuizContextError', message, userMessage, status: 409, code, details },
);

export function assertGeneratedQuizContext(quiz, { courseId, classId } = {}) {
  const expectedCourseId = normalizeCourseId(courseId);
  const actualCourseId = normalizeCourseId(quiz?.courseId);
  const expectedClassId = String(classId || '').trim();
  const actualClassId = String(quiz?.classId || '').trim();

  if (expectedCourseId && actualCourseId && expectedCourseId !== actualCourseId) {
    throw createContextError({
      message: `Generated quiz course mismatch: expected ${expectedCourseId}, received ${actualCourseId}.`,
      userMessage: `The generated quiz belongs to ${actualCourseId}, not ${expectedCourseId}. It was blocked to prevent studying the wrong course.`,
      status: 409,
      code: 'QUIZ_COURSE_CONTEXT_MISMATCH',
      details: { expectedCourseId, actualCourseId, quizSessionId: quiz?.quizSessionId, assignmentId: quiz?.assignmentId },
    });
  }

  if (expectedClassId && actualClassId && !classIdMatches(expectedClassId, actualClassId)) {
    throw createContextError({
      message: `Generated quiz class mismatch: expected ${expectedClassId}, received ${actualClassId}.`,
      userMessage: `The generated quiz belongs to class ${actualClassId}, not ${expectedClassId}. It was blocked to prevent using the wrong class material.`,
      status: 409,
      code: 'QUIZ_CLASS_CONTEXT_MISMATCH',
      details: { expectedClassId, actualClassId, quizSessionId: quiz?.quizSessionId, assignmentId: quiz?.assignmentId },
    });
  }

  return quiz;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { assertGeneratedQuizContext } from '../src/features/ai-harness/quizContext.js';

test('accepts a generated quiz scoped to the requested course and class', () => {
  const quiz = { quizSessionId: 'quiz-1', courseId: 'OSG202', classId: 'SE1833' };
  assert.equal(assertGeneratedQuizContext(quiz, { courseId: 'osg202', classId: '1833' }), quiz);
});

test('blocks a generated quiz returned for another course', () => {
  assert.throws(
    () => assertGeneratedQuizContext(
      { quizSessionId: 'quiz-2', courseId: 'PRO192', classId: 'SE1833' },
      { courseId: 'OSG202', classId: 'SE1833' },
    ),
    (error) => error.code === 'QUIZ_COURSE_CONTEXT_MISMATCH' && /PRO192, not OSG202/.test(error.userMessage),
  );
});

test('blocks a generated quiz returned for another class', () => {
  assert.throws(
    () => assertGeneratedQuizContext(
      { assignmentId: 'assignment-1', courseId: 'OSG202', classId: 'SE1840' },
      { courseId: 'OSG202', classId: 'SE1833' },
    ),
    (error) => error.code === 'QUIZ_CLASS_CONTEXT_MISMATCH',
  );
});

test('allows old summary responses that omit scope fields', () => {
  const summary = { quizSessionId: 'quiz-legacy' };
  assert.equal(assertGeneratedQuizContext(summary, { courseId: 'OSG202', classId: 'SE1833' }), summary);
});

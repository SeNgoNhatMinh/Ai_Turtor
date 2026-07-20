import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStudentNextSteps } from '../src/features/student/learning/studentNextStepUtils.js';

test('builds student next steps only from canonical pending records', () => {
  const items = buildStudentNextSteps({
    assignments: [
      { id: 'a-done', title: 'Done', dueAt: '2026-07-20T08:00:00Z' },
      { id: 'a-next', title: 'OOP Assignment', dueAt: '2026-07-21T08:00:00Z' },
    ],
    submissions: [{ assignmentId: 'a-done', status: 'SUBMITTED' }],
    quizHistory: [{ id: 'quiz-1', title: 'Inheritance Quiz', status: 'GENERATED' }],
    assignedQuizzes: [{ id: 'qa-1', title: 'Class Quiz', status: 'PUBLISHED' }],
    escalations: [{ id: 'esc-1', question: 'Explain polymorphism', status: 'RESOLVED' }],
  });

  assert.deepEqual(items.map((item) => item.key), [
    'assignment:a-next',
    'quiz:quiz-1',
    'assigned-quiz:qa-1',
    'support:esc-1',
  ]);
  assert.deepEqual(items.map((item) => item.tab), [
    'student-materials',
    'student-quizzes',
    'student-quizzes',
    'student-escalation',
  ]);
});

test('does not show completed work or an assigned quiz that already has an attempt', () => {
  const items = buildStudentNextSteps({
    assignments: [{ id: 'a-1', title: 'Submitted', status: 'SUBMITTED' }],
    quizHistory: [{ id: 'session-1', assignmentId: 'qa-1', status: 'SUBMITTED' }],
    assignedQuizzes: [{ id: 'qa-1', title: 'Already attempted', status: 'PUBLISHED' }],
    escalations: [{ id: 'esc-1', status: 'WAITING_FOR_MENTOR' }],
  });

  assert.deepEqual(items, []);
});

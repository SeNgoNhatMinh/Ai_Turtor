import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getQuizId,
  getQuizScoreText,
  getQuizStatusLabel,
  sortQuizHistory,
} from '../src/features/student/quizzes/practiceQuizUtils.js';
import {
  normalizeImprovePlan,
  normalizeQuizAssignment,
  normalizeQuizSession,
  normalizeTeacherQuizAttempt,
} from '../src/services/normalizers.js';

test('normalizes quiz sessions and assignments from backend aliases', () => {
  const quiz = normalizeQuizSession({
    sessionId: 'quiz-1',
    type: 'ASSIGNED',
    autoScore: 2,
    questions: [{ id: 'q1' }, { id: 'q2' }],
  });
  const assignment = normalizeQuizAssignment({
    assignmentId: 'assignment-1',
    name: 'OOP Review',
    questions: [{ id: 'q1' }],
  });

  assert.equal(getQuizId(quiz), 'quiz-1');
  assert.equal(quiz.quizType, 'ASSIGNED');
  assert.equal(quiz.maxScore, 2);
  assert.equal(assignment.title, 'OOP Review');
  assert.equal(assignment.questionCount, 1);
});

test('uses clear quiz status and score labels', () => {
  assert.equal(getQuizStatusLabel({ status: 'GENERATED' }), 'In progress');
  assert.equal(getQuizStatusLabel({ status: 'SUBMITTED', quizType: 'ASSIGNED' }), 'Submitted - waiting review');
  assert.equal(getQuizStatusLabel({ teacherReviewStatus: 'REVIEWED' }), 'Teacher reviewed');
  assert.equal(getQuizScoreText({ teacherReviewedScore: 8, maxScore: 10 }), 'Score 8/10');
});

test('normalizes teacher quiz attempt summaries without loading student histories', () => {
  const attempt = normalizeTeacherQuizAttempt({
    quizSessionId: 'attempt-1',
    studentId: 'student-1',
    autoScore: 6,
    teacherReviewedScore: 8,
    finalScore: 8,
    maxScore: 10,
    autoPercentage: 60,
    finalPercentage: 80,
    teacherReviewStatus: 'REVIEWED',
  });

  assert.equal(attempt.id, 'attempt-1');
  assert.equal(attempt.score, 6);
  assert.equal(attempt.finalScore, 8);
  assert.equal(attempt.finalPercentage, 80);
  assert.equal(attempt.teacherReviewStatus, 'REVIEWED');
});

test('sorts quiz history by latest activity', () => {
  const sorted = sortQuizHistory([
    { id: 'old', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'new', updatedAt: '2026-07-16T00:00:00Z' },
  ]);
  assert.deepEqual(sorted.map((quiz) => quiz.id), ['new', 'old']);
});

test('normalizes improve plan identifiers and arrays', () => {
  const plan = normalizeImprovePlan({
    planId: 'plan-1',
    items: ['Review inheritance'],
    weakTopics: ['Inheritance'],
  });
  assert.equal(plan.id, 'plan-1');
  assert.deepEqual(plan.planItems, ['Review inheritance']);
  assert.deepEqual(plan.weakTopics, ['Inheritance']);
});

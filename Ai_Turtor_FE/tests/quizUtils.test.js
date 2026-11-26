import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getQuizId,
  getQuizScoreText,
  getQuizStatusLabel,
  normalizeQuizQuestionCount,
  sortQuizHistory,
} from '../src/features/student/quizzes/practiceQuizUtils.js';
import {
  normalizeImprovePlan,
  normalizeQuizSession,
} from '../src/services/normalizers.js';
import {
  getAnswerForQuestion,
  getQuizReviewDetails,
} from '../src/features/student/quizzes/quizQuestionUtils.js';
import {
  findTeacherClass,
  getClassCourseId,
  getClassOptionValue,
} from '../src/features/teacher/shared/teacherUtils.js';
test('normalizes quiz sessions from backend aliases', () => {
  const quiz = normalizeQuizSession({
    sessionId: 'quiz-1',
    type: 'ASSIGNED',
    autoScore: 2,
    questions: [{ id: 'q1' }, { id: 'q2' }],
  });
  assert.equal(getQuizId(quiz), 'quiz-1');
  assert.equal(quiz.quizType, 'ASSIGNED');
  assert.equal(quiz.maxScore, 2);
});

test('uses clear quiz status and score labels', () => {
  assert.equal(getQuizStatusLabel({ status: 'GENERATED' }), 'Đang làm');
  assert.equal(getQuizStatusLabel({ status: 'SUBMITTED', quizType: 'ASSIGNED' }), 'Đã nộp');
  assert.equal(getQuizStatusLabel({ teacherReviewStatus: 'REVIEWED' }), 'Giảng viên đã duyệt');
  assert.equal(getQuizScoreText({ teacherReviewedScore: 8, maxScore: 10 }), 'Điểm 8/10');
});

test('normalizes requested quiz question count as an integer between 3 and 10', () => {
  assert.equal(normalizeQuizQuestionCount('10'), 10);
  assert.equal(normalizeQuizQuestionCount(6.6), 7);
  assert.equal(normalizeQuizQuestionCount(1), 3);
  assert.equal(normalizeQuizQuestionCount(99), 10);
  assert.equal(normalizeQuizQuestionCount(null), 5);
});

test('preserves a pending teacher-manual score as null', () => {
  const quiz = normalizeQuizSession({
    quizSessionId: 'manual-quiz',
    gradingMode: 'TEACHER_MANUAL',
    status: 'SUBMITTED',
    score: null,
    autoScore: null,
  });
  assert.equal(quiz.score, null);
  assert.equal(quiz.autoScore, null);
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

test('builds a complete submitted quiz review with selected and correct choices', () => {
  const question = {
    questionId: 'q1',
    options: ['Encapsulation', 'Inheritance', 'Polymorphism', 'Abstraction'],
    correctAnswer: 'Inheritance',
  };
  const answers = [{
    questionId: 'q1',
    selectedAnswer: 'Encapsulation',
    correct: false,
    correctAnswer: 'Inheritance',
    explanation: 'Inheritance lets a class reuse behavior from another class.',
  }];

  const answer = getAnswerForQuestion(answers, question, 0);
  const review = getQuizReviewDetails(question, answer);

  assert.equal(review.isCorrect, false);
  assert.equal(review.choices.length, 4);
  assert.equal(review.choices.find((choice) => choice.isSelected)?.text, 'Encapsulation');
  assert.equal(review.choices.find((choice) => choice.isCorrectAnswer)?.text, 'Inheritance');
  assert.match(review.explanation, /reuse behavior/);
});

test('marks one option as both student choice and correct answer', () => {
  const review = getQuizReviewDetails(
    { questionId: 'q1', options: ['True', 'False'], correctAnswer: 'True' },
    { questionId: 'q1', selectedAnswer: ' true ', correct: true },
  );

  const selected = review.choices.find((choice) => choice.isSelected);
  assert.equal(review.isCorrect, true);
  assert.equal(selected.text, 'True');
  assert.equal(selected.isCorrectAnswer, true);
});

test('resolves the canonical teacher class used by student enrollment', () => {
  const classes = [{
    classCode: 'SE1833',
    classId: '1833',
    course: { courseId: 'PRO192' },
  }];
  const matchedClass = findTeacherClass(classes, '1833');

  assert.equal(getClassOptionValue(matchedClass), '1833');
  assert.equal(getClassCourseId(matchedClass), 'PRO192');
});

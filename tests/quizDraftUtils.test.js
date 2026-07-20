import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuizDraftPayload,
  createDraftQuestion,
  QUIZ_QUESTION_TYPES,
  setDraftQuestionType,
  updateDraftOption,
  validateQuizDraft,
} from '../src/features/teacher/quizzes/quizDraftUtils.js';

const validQuestion = {
  questionId: 'q-1',
  type: 'MULTIPLE_CHOICE',
  questionText: 'What is encapsulation?',
  options: ['Hiding implementation details', 'Creating many classes'],
  correctAnswer: 'Hiding implementation details',
  explanation: 'Encapsulation protects internal state.',
};

test('quiz draft validation requires a correct answer from the options', () => {
  assert.equal(validateQuizDraft([validQuestion]).valid, true);
  const invalid = validateQuizDraft([{ ...validQuestion, correctAnswer: 'Unknown answer' }]);
  assert.equal(invalid.valid, false);
  assert.match(invalid.questionErrors[0].join(' '), /phải thuộc danh sách lựa chọn/i);
});

test('quiz draft validation rejects duplicate options', () => {
  const result = validateQuizDraft([{ ...validQuestion, options: ['Java', ' java '] }]);
  assert.equal(result.valid, false);
  assert.match(result.questionErrors[0].join(' '), /không được trùng nhau/i);
});

test('editing the selected option keeps the answer key synchronized', () => {
  const updated = updateDraftOption(validQuestion, 0, 'Protecting internal state');
  assert.equal(updated.options[0], 'Protecting internal state');
  assert.equal(updated.correctAnswer, 'Protecting internal state');
});

test('true false questions use the backend-compatible answer values', () => {
  const question = createDraftQuestion(validQuestion);
  const updated = setDraftQuestionType(question, QUIZ_QUESTION_TYPES.TRUE_FALSE);
  assert.deepEqual(updated.options, ['Đúng', 'Sai']);
  assert.equal(updated.correctAnswer, '');
});

test('quiz draft payload trims fields and preserves the canonical option value', () => {
  const payload = buildQuizDraftPayload(
    { title: ' OOP Quiz ', topic: ' OOP ', suggestionText: ' Review encapsulation ' },
    [{ ...validQuestion, options: [' Java ', 'Python'], correctAnswer: 'java' }],
  );
  assert.equal(payload.title, 'OOP Quiz');
  assert.equal(payload.questions[0].correctAnswer, 'Java');
  assert.deepEqual(payload.questions[0].options, ['Java', 'Python']);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatStudySuggestion,
  isLongStudySuggestion,
} from '../src/features/student/learning/learningProgressUtils.js';

test('formats suggestion summary and steps without changing their meaning', () => {
  const formatted = formatStudySuggestion({
    title: 'Improvement Plan: JSP',
    content: 'Cần củng cố servlet lifecycle.\nCác bước tiếp theo:\n- Ôn init\n- Làm quiz',
  });

  assert.equal(formatted.title, 'Kế hoạch cải thiện: JSP');
  assert.equal(formatted.summary, 'Cần củng cố servlet lifecycle.');
  assert.deepEqual(formatted.steps, ['Ôn init', 'Làm quiz']);
});

test('detects long suggestions that should use the detail modal', () => {
  assert.equal(isLongStudySuggestion({
    title: 'Ôn lại chủ đề còn yếu',
    summary: 'Nội dung ngắn',
    steps: ['Bước 1', 'Bước 2', 'Bước 3', 'Bước 4'],
  }), true);

  assert.equal(isLongStudySuggestion({
    title: 'JSP',
    summary: 'Luyện tập servlet lifecycle.',
    steps: ['Làm quiz'],
  }), false);
});

test('uses structured backend next steps without exposing JSON formatting', () => {
  const formatted = formatStudySuggestion({
    title: 'Ôn lại các chủ đề yếu',
    reason: 'Bạn đang yếu ở JSP và Code debugging.',
    nextSteps: ['Ôn lại JSP.', 'Thực hành debug với breakpoint.'],
  });

  assert.equal(formatted.summary, 'Bạn đang yếu ở JSP và Code debugging.');
  assert.deepEqual(formatted.steps, ['Ôn lại JSP.', 'Thực hành debug với breakpoint.']);
});

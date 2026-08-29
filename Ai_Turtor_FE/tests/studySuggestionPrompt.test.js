import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStudySuggestionPrompt } from '../src/features/student/learning/studySuggestionPrompt.js';

test('builds the visible student chat message for an improve suggestion', () => {
  assert.equal(
    buildStudySuggestionPrompt('Nắm vững các khái niệm IoC và DI'),
    'Em muốn ôn tập phần "Nắm vững các khái niệm IoC và DI" từ improve plan. Hãy hướng dẫn em từng bước trong đoạn chat này, giải thích dễ hiểu, có ví dụ nhỏ và gợi ý em nên tự kiểm tra gì tiếp theo.',
  );
});

test('does not build a chat message for an empty suggestion', () => {
  assert.equal(buildStudySuggestionPrompt('   '), '');
});

test('sends a numbered lesson chip as a lesson start, not an improve-plan wrap', () => {
  assert.equal(
    buildStudySuggestionPrompt('Bài 1: Servlet là gì?'),
    'Bắt đầu bài 1: Servlet là gì?',
  );
  assert.equal(
    buildStudySuggestionPrompt('Bắt đầu bài 2: Request và Response'),
    'Bắt đầu bài 2: Request và Response',
  );
});

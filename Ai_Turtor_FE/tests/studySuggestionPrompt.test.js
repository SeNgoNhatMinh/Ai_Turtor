import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLessonChatPrompt, buildStudySuggestionPrompt, lessonSuggestionsForMessage, parseLessonSuggestionsFromAnswer } from '../src/features/student/learning/studySuggestionPrompt.js';

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

test('course opening chips start the same topic-study flow as hôm nay mình học', () => {
  assert.equal(
    buildLessonChatPrompt('Chapter 3 Functions'),
    'Nay mình học Chapter 3 Functions',
  );
  assert.equal(
    buildLessonChatPrompt('Nay mình học Servlet'),
    'Nay mình học Servlet',
  );
  assert.equal(
    buildLessonChatPrompt('Bài 1: Servlet là gì?'),
    'Bắt đầu bài 1: Servlet là gì?',
  );
});

test('parses numbered Bài lines from a learning-path answer even with markdown bold', () => {
  const items = parseLessonSuggestionsFromAnswer(`
## Lộ trình học
1. **Bài 1: Giới thiệu vòng lặp \`for\`** – hiểu cú pháp.
2. Bài 2: Vòng lặp while
6. Bài 6: Xử lý lỗi ngữ nghĩa (semantic error) khi viết vòng lặp – tránh lỗi logic.

## Bắt đầu thế nào
Bạn muốn bắt đầu với bài nào? Gợi ý: **Bắt đầu bài 1: Giới thiệu vòng lặp for**.
`);
  assert.deepEqual(items.map((item) => item.title), [
    'Bắt đầu bài 1: Giới thiệu vòng lặp for – hiểu cú pháp.',
    'Bắt đầu bài 2: Vòng lặp while',
    'Bắt đầu bài 6: Xử lý lỗi ngữ nghĩa (semantic error) khi viết vòng lặp – tránh lỗi logic.',
  ]);
});

test('uses parsed lessons when the API did not send nextImproveSuggestions', () => {
  const parsed = lessonSuggestionsForMessage({
    answer: '1. Bài 1: Servlet là gì?\n2. Bài 2: Request',
    nextImproveSuggestions: [],
  });
  assert.equal(parsed[0].title, 'Bắt đầu bài 1: Servlet là gì?');
});

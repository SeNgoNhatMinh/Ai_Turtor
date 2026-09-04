import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDeepDiveListPrompt,
  buildDeepDiveTopicPrompt,
  buildLessonChatPrompt,
  buildStudySuggestionPrompt,
  lessonSuggestionsForMessage,
  parseDeepDiveSuggestionsFromAnswer,
  parseLessonSuggestionsFromAnswer,
  parseNextLessonSuggestionsFromAnswer,
  resolveChatStudyTip,
  teacherStudentPathLabel,
} from '../src/features/student/learning/studySuggestionPrompt.js';

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

test('numbered lesson with an en-dash still starts that lesson', () => {
  assert.equal(
    buildStudySuggestionPrompt('Bài 2 – Sử dụng biến lặp (itervar) trong thân vòng.'),
    'Bắt đầu bài 2: Sử dụng biến lặp (itervar) trong thân vòng.',
  );
  assert.equal(
    buildLessonChatPrompt('Bài 2 – Sử dụng biến lặp (itervar) trong thân vòng.'),
    'Bắt đầu bài 2: Sử dụng biến lặp (itervar) trong thân vòng.',
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

test('asks AI for deeper angles of the current numbered lesson', () => {
  assert.equal(
    buildDeepDiveListPrompt('Bắt đầu bài 3: Cache'),
    'Gợi ý học chuyên sâu bài 3: Cache',
  );
  assert.equal(buildDeepDiveListPrompt('Gợi ý học chuyên sâu bài 3: Cache'), '');
  assert.equal(buildDeepDiveListPrompt('Đào sâu bài 3: Cache miss'), '');
  assert.equal(
    buildDeepDiveListPrompt(
      'Bắt đầu bài 4: Cache',
      '## Học chuyên sâu\n- So sánh L1 và L2\n\n## Bài tiếp theo\n- Bài 5: File',
    ),
    '',
  );
  assert.equal(
    buildDeepDiveListPrompt(
      'Bắt đầu bài 4: Cache',
      '## Học tiếp phần này\n- False sharing\n\n## Bài tiếp theo\n- Bài 5: File',
    ),
    '',
  );
  assert.equal(
    buildStudySuggestionPrompt('Gợi ý học chuyên sâu bài 3: Cache'),
    'Gợi ý học chuyên sâu bài 3: Cache',
  );
});

test('deep-dive bullets stay on the current bài instead of starting the next one', () => {
  assert.equal(
    buildDeepDiveTopicPrompt('3', 'Cache miss khi CPU không tìm thấy dữ liệu'),
    'Đào sâu bài 3: Cache miss khi CPU không tìm thấy dữ liệu',
  );
  assert.equal(
    resolveChatStudyTip(
      'Gợi ý học chuyên sâu bài 3: Cache',
      'Cache miss khi CPU không tìm thấy dữ liệu',
    ),
    'Đào sâu bài 3: Cache miss khi CPU không tìm thấy dữ liệu',
  );
  assert.equal(
    resolveChatStudyTip(
      'Gợi ý học chuyên sâu bài 3: Cache',
      'Bài 4: Các cấp độ cache (L1, L2)',
    ),
    'Bắt đầu bài 4: Các cấp độ cache (L1, L2)',
  );
  assert.equal(
    resolveChatStudyTip(
      'Đào sâu bài 4: Phân tích cách các core đa lõi chia sẻ cache L2/L3',
      'False sharing khi hai core ghi cùng cache line',
    ),
    'Đào sâu bài 4: False sharing khi hai core ghi cùng cache line',
  );
  assert.equal(
    buildStudySuggestionPrompt('Đào sâu bài 3: Cache miss khi CPU không tìm thấy dữ liệu'),
    'Đào sâu bài 3: Cache miss khi CPU không tìm thấy dữ liệu',
  );
});

test('extracts deep-dive bullets for the teacher transcript review', () => {
  const items = parseDeepDiveSuggestionsFromAnswer(`
## Học chuyên sâu
- Cache miss khi CPU không tìm thấy dữ liệu
- False sharing khi hai core ghi cùng cache line

## Bài tiếp theo
- Bài 4: File system
`);
  assert.deepEqual(items.map((item) => item.suggestionText), [
    'Cache miss khi CPU không tìm thấy dữ liệu',
    'False sharing khi hai core ghi cùng cache line',
  ]);
  assert.equal(teacherStudentPathLabel('Gợi ý học chuyên sâu bài 3: Cache'), 'Yêu cầu học chuyên sâu');
  assert.equal(teacherStudentPathLabel('Đào sâu bài 3: Cache miss'), 'Đào sâu bài 3');
  assert.deepEqual(
    parseNextLessonSuggestionsFromAnswer(`
## Bài tiếp theo
- Bài 4: File system
`).map((item) => item.suggestionText),
    ['Bài 4: File system'],
  );
});

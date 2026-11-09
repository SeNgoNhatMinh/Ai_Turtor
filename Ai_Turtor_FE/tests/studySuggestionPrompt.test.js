import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDeepDiveListPrompt,
  buildDeepDiveTopicPrompt,
  buildLessonChatPrompt,
  buildStudySuggestionPrompt,
  lessonSuggestionsForMessage,
  parseCurriculumStarterSuggestions,
  parseDeepDiveSuggestionsFromAnswer,
  parseLessonSuggestionsFromAnswer,
  parseNextLessonSuggestionsFromAnswer,
  resolveChatStudyTip,
  stripConcatenatedLessonTail,
  teacherStudentPathLabel,
} from '../src/features/student/learning/studySuggestionPrompt.js';

test('keeps a numbered chapter 1 and drops the book appendix', () => {
  const items = parseCurriculumStarterSuggestions(`
## 4. Gợi ý học tập

- Chapter 1. Introduction to JSP
- Chương 2. Servlet cơ bản
- Appendix A. Installing Tomcat
- Introduction
`);
  assert.deepEqual(items.map((item) => item.suggestionText), [
    'Chapter 1. Introduction to JSP',
    'Chương 2. Servlet cơ bản',
  ]);
});

test('parses curriculum starter suggestions into clickable chips', () => {
  const items = parseCurriculumStarterSuggestions(`
## 3. Các chủ đề trọng tâm

- **Tổng quan về Pascal**: giới thiệu.

## 4. Gợi ý học tập

Các chương trong tài liệu môn học (chọn một chương để bắt đầu):

- Tổng quan về Pascal
- Cấu trúc rẽ nhánh & Vòng lặp
- Kiểu dữ liệu
- Hàm và thủ tục
- Mảng một chiều
- Con trỏ

**Mẹo:** Chọn một chương cụ thể để AI Tutor lấy nội dung từ tài liệu môn và hướng dẫn bạn học.
`);
  assert.deepEqual(items.map((item) => item.suggestionText), [
    'Tổng quan về Pascal',
    'Cấu trúc rẽ nhánh & Vòng lặp',
    'Kiểu dữ liệu',
    'Hàm và thủ tục',
    'Mảng một chiều',
    'Con trỏ',
  ]);
  assert.equal(items.every((item) => item.curriculumStarter), true);
});

test('shows the Vietnamese lesson label and keeps the outline heading', () => {
  const items = parseCurriculumStarterSuggestions(`
## 4. Gợi ý học tập

- Bài 1: Giới thiệu nền tảng Java EE || Chapter 1: Introducing Java Platform, Enterprise Edition
- Understanding the Basic Web Application Structure
`);
  assert.equal(items[0].title, 'Bài 1: Giới thiệu nền tảng Java EE');
  assert.equal(items[0].suggestionText, 'Bài 1: Giới thiệu nền tảng Java EE');
  assert.equal(items[0].chapterTitle, 'Chapter 1: Introducing Java Platform, Enterprise Edition');
  assert.equal(items[1].chapterTitle, '');
});

test('sends a curriculum chapter title as a study ask', () => {
  assert.equal(
    buildStudySuggestionPrompt('Tổng quan về Pascal', { curriculumStarter: true }),
    'Tôi muốn tìm hiểu về Tổng quan về Pascal.',
  );
});

test('sends a legacy curriculum starter question verbatim', () => {
  assert.equal(
    buildStudySuggestionPrompt('Kiểm tra kiến thức của tôi về Vòng lặp.', { curriculumStarter: true }),
    'Kiểm tra kiến thức của tôi về Vòng lặp.',
  );
});

test('builds the visible student chat message for a generic study suggestion', () => {
  assert.equal(
    buildStudySuggestionPrompt('Nắm vững các khái niệm IoC và DI'),
    'Ôn tập phần "Nắm vững các khái niệm IoC và DI"',
  );
});

test('uses the grounded review prompt for an identified improve-plan item', () => {
  assert.equal(
    buildStudySuggestionPrompt('Nắm vững IoC và DI', {
      improvePlanId: 'plan-1',
      planItemId: 'item-1',
    }),
    'Ôn tập theo Improve Plan: Nắm vững IoC và DI',
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

test('uses parsed lessons only for historical messages without the API field', () => {
  const parsed = lessonSuggestionsForMessage({
    answer: '1. Bài 1: Servlet là gì?\n2. Bài 2: Request',
  });
  assert.equal(parsed[0].title, 'Bắt đầu bài 1: Servlet là gì?');
});

test('does not expose unverified lessons when the API returns no grounded chapters', () => {
  const parsed = lessonSuggestionsForMessage({
    answer: '1. Bai 1: Invented topic\n2. Bai 2: Another invented topic',
    nextImproveSuggestions: [],
  });
  assert.deepEqual(parsed, []);
});

test('does not copy generic roadmap evidence into guided lessons', () => {
  const parsed = lessonSuggestionsForMessage({
    answer: '1. Bai 1: Vong lap while\n2. Bai 2: Lenh continue',
    sourceEvidence: [
      { materialId: 'python-book', chunkId: 'loops-1' },
      { materialId: 'python-book', chunkId: 'loops-2' },
    ],
  });

  assert.equal(parsed[0].interactionType, 'GUIDED_LESSON');
  assert.deepEqual(parsed[0].sourceMaterialIds, []);
  assert.deepEqual(parsed[0].sourceChunkIds, []);
});

test('keeps chapter-bound provenance supplied for each guided lesson', () => {
  const parsed = lessonSuggestionsForMessage({
    nextImproveSuggestions: [{
      title: 'Bai 2: Dictionary debugging',
      chapterKey: 'dictionary-debugging',
      chapterTitle: 'Dictionary debugging',
      sourceMaterialIds: ['python-book'],
      sourceChunkIds: ['dictionary-2'],
    }],
    sourceEvidence: [{ materialId: 'wrong-material', chunkId: 'copyright-page' }],
  });

  assert.equal(parsed[0].chapterKey, 'dictionary-debugging');
  assert.equal(parsed[0].chapterTitle, 'Dictionary debugging');
  assert.deepEqual(parsed[0].sourceMaterialIds, ['python-book']);
  assert.deepEqual(parsed[0].sourceChunkIds, ['dictionary-2']);
});

test('drops review-workflow titles from lesson chips', () => {
  const parsed = lessonSuggestionsForMessage({
    nextImproveSuggestions: [{
      title: 'Bắt đầu bài 1: Senior-approved knowledge: Đào sâu bài 3: Quy tắc ưu tiên',
      chapterTitle: 'Senior-approved knowledge: Đào sâu bài 3: Quy tắc ưu tiên',
    }],
    answer: '1. Bài 1: Kiểu dữ liệu\n2. Bài 2: Con trỏ',
  });

  assert.deepEqual(parsed, []);
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
  assert.equal(
    resolveChatStudyTip('Servlet filter là gì?', 'So sánh Filter và Interceptor'),
    'Đào sâu: So sánh Filter và Interceptor',
  );
  assert.equal(
    buildStudySuggestionPrompt('Đào sâu: So sánh Filter và Interceptor', {
      interactionType: 'SOURCE_BACKED_STUDY_TIP',
    }),
    'Đào sâu: So sánh Filter và Interceptor',
  );
  assert.equal(
    buildStudySuggestionPrompt('So sánh Filter và Interceptor', {
      interactionType: 'SOURCE_BACKED_STUDY_TIP',
    }),
    'So sánh Filter và Interceptor',
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

test('strips leftover numbered start text from Bài tiếp theo for every course', () => {
  assert.equal(
    stripConcatenatedLessonTail('Bài 6: Parameters and arguments 7. Bắt đầu'),
    'Bài 6: Parameters and arguments',
  );
  assert.equal(
    buildStudySuggestionPrompt('Bài 6: Parameters and arguments 7. Bắt đầu'),
    'Bắt đầu bài 6: Parameters and arguments',
  );
  assert.deepEqual(
    parseNextLessonSuggestionsFromAnswer(`
## Bài tiếp theo
- Bài 6: Parameters and arguments 7. Bắt đầu
`).map((item) => item.suggestionText),
    ['Bài 6: Parameters and arguments'],
  );
  assert.deepEqual(
    parseLessonSuggestionsFromAnswer(`
1. Bài 6: Parameters and arguments 7. Bắt đầu bài 7: Fruitful functions
2. Bài 8: Return values
`).map((item) => item.title),
    [
      'Bắt đầu bài 6: Parameters and arguments',
      'Bắt đầu bài 7: Fruitful functions',
      'Bắt đầu bài 8: Return values',
    ],
  );
});

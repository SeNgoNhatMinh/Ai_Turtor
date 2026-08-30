import test from 'node:test';
import assert from 'node:assert/strict';
import { extractUnderstandingCheck, parseUnderstandingQuiz, buildUnderstandingCheckPrompt } from '../src/features/student/chat/understandingCheck.js';

test('parses parenthesized A/B/C options on one line', () => {
  const quiz = parseUnderstandingQuiz(
    "Vai trò của Controller trong MVC là gì? (A) Chỉ xử lý yêu cầu từ View (B) Chỉ truy cập Model (C) Xử lý yêu cầu từ View, truy cập Model và chuẩn bị dữ liệu cho View.",
  );
  assert.equal(quiz.question, 'Vai trò của Controller trong MVC là gì?');
  assert.deepEqual(quiz.options.map((item) => item.key), ['A', 'B', 'C']);
  assert.match(quiz.options[2].text, /chuẩn bị dữ liệu cho View/);
});

test('treats Understanding Check as the quiz heading', () => {
  const extracted = extractUnderstandingCheck(`
## Giải thích
Controller nối View và Model.

## Understanding Check
Bạn có thể giải thích vai trò của Controller không? (A) Chỉ View (B) Chỉ Model (C) View và Model
`);
  assert.ok(extracted.quiz);
  assert.equal(extracted.quiz.options.length, 3);
  assert.doesNotMatch(extracted.before, /Understanding Check/);
});

test('parses an inline A/B/C understanding check', () => {
  const quiz = parseUnderstandingQuiz(
    "Khi dùng vòng lặp for để duyệt danh sách fruits, biến lặp sẽ có giá trị nào ở lần lặp thứ hai? A. 'apple' B. 'banana' C. 'cherry'",
  );

  assert.equal(quiz.question, "Khi dùng vòng lặp for để duyệt danh sách fruits, biến lặp sẽ có giá trị nào ở lần lặp thứ hai?");
  assert.deepEqual(quiz.options.map((item) => item.key), ['A', 'B', 'C']);
  assert.equal(quiz.options[1].text, "'banana'");
  assert.equal(quiz.correctKey, '');
});

test('drops a trailing markdown rule from the last option', () => {
  const quiz = parseUnderstandingQuiz(
    "Khi dùng vòng lặp for, biến lặp lần hai là gì? A. 'apple' B. 'banana' C. 'cherry' ---",
  );
  assert.equal(quiz.options[2].text, "'cherry'");
});

test('hides the answer key until the quiz widget reads it', () => {
  const extracted = extractUnderstandingCheck(`
## Giải thích
for duyệt từng phần tử.

## Kiểm tra hiểu
Câu hỏi: Lần lặp thứ hai của fruits lấy giá trị nào?
A. apple
B. banana
C. cherry
Đáp án: B
Giải thích: Index 1 là banana.

## Bài tiếp theo
- Bài 2: Biến lặp
`);

  assert.match(extracted.before, /for duyệt từng phần tử/);
  assert.doesNotMatch(extracted.before, /Đáp án/);
  assert.match(extracted.after, /Bài 2: Biến lặp/);
  assert.equal(extracted.quiz.correctKey, 'B');
  assert.equal(extracted.quiz.explanation, 'Index 1 là banana.');
  assert.equal(extracted.quiz.options[1].text, 'banana');
});

test('grades leaked answer text without calling the tutor', () => {
  const quiz = parseUnderstandingQuiz(`
Câu hỏi: Bạn hiểu đúng về vai trò của Controller trong kiến trúc MVC chưa?
A. Controller chỉ chịu trách nhiệm xử lý yêu cầu từ View.
B. Controller chịu trách nhiệm cả xử lý yêu cầu từ View và cập nhật dữ liệu trong Model.
C. Controller chỉ chịu trách nhiệm cập nhật dữ liệu trong Model. Nếu bạn chọn đáp án B, bạn có thể muốn tìm hiểu thêm về cách Controller tương tác với Model và View.
`);
  assert.equal(quiz.correctKey, 'B');
  assert.equal(quiz.options[2].text, 'Controller chỉ chịu trách nhiệm cập nhật dữ liệu trong Model.');
  assert.match(quiz.explanation, /Controller tương tác với Model và View/);
});

test('builds an in-place grading prompt instead of a new study-start chat', () => {
  const prompt = buildUnderstandingCheckPrompt(
    {
      question: "Lần lặp thứ hai lấy giá trị nào?",
      options: [
        { key: 'A', text: "'apple'" },
        { key: 'B', text: "'banana'" },
      ],
    },
    { key: 'B', text: "'banana'" },
  );
  assert.match(prompt, /Học sinh chọn: B/);
  assert.match(prompt, /không phải chủ đề mới/);
  assert.doesNotMatch(prompt, /Nay mình học/);
});

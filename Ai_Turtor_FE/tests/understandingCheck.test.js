import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUnderstandingCheckPrompt,
  extractUnderstandingCheck,
  normalizeStructuredUnderstandingQuiz,
  parseUnderstandingQuiz,
} from '../src/features/student/chat/understandingCheck.js';

test('validates a structured understanding-check payload from the API', () => {
  const quiz = normalizeStructuredUnderstandingQuiz({
    question: 'Servlet gọi phương thức nào trước?',
    options: [
      { key: 'a', text: 'service()' },
      { key: 'B', text: 'init()' },
      { key: 'B', text: 'duplicate must be ignored' },
      { key: 'x', text: 'invalid key' },
    ],
    correctKey: 'b',
    explanation: 'init() khởi tạo tài nguyên.',
  });

  assert.deepEqual(quiz.options, [
    { key: 'A', text: 'service()' },
    { key: 'B', text: 'init()' },
  ]);
  assert.equal(quiz.correctKey, 'B');
  assert.equal(quiz.explanation, 'init() khởi tạo tài nguyên.');
});

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

test('hides an inline answer and explanation leaked into the last option', () => {
  const extracted = extractUnderstandingCheck(`
## Kiểm tra hiểu
Câu hỏi: Khi một Servlet được tải lần đầu, phương thức nào được gọi đầu tiên?
A. service() xử lý HTTP ngay lập tức
B. init() thiết lập tài nguyên cần thiết
C. destroy() giải phóng tài nguyên. **Giải thích:** init() được gọi ngay sau khi Servlet được khởi tạo. **Đáp án:** B **Giải thích:** init() chuẩn bị tài nguyên.
`);

  assert.equal(extracted.quiz.correctKey, 'B');
  assert.equal(extracted.quiz.options[2].text, 'destroy() giải phóng tài nguyên.');
  assert.equal(extracted.quiz.explanation, 'init() được gọi ngay sau khi Servlet được khởi tạo.');
  assert.doesNotMatch(extracted.quiz.explanation, /Đáp án|Giải thích/);
  assert.doesNotMatch(extracted.before, /Đáp án|Giải thích/);
  assert.doesNotMatch(extracted.after, /Đáp án|Giải thích/);
});

test('keeps an answer below a markdown rule inside the hidden quiz payload', () => {
  const extracted = extractUnderstandingCheck(`
## Kiểm tra hiểu
Câu hỏi: Servlet callback đầu tiên là gì?
A. service()
B. init()
C. destroy()
---
Đáp án: B Giải thích: init() chạy một lần khi khởi tạo.
`);

  assert.equal(extracted.quiz.correctKey, 'B');
  assert.equal(extracted.quiz.options[2].text, 'destroy()');
  assert.equal(extracted.quiz.explanation, 'init() chạy một lần khi khởi tạo.');
  assert.equal(extracted.after, '');
});

test('parses Đáp án without a colon', () => {
  const quiz = parseUnderstandingQuiz(`
Câu hỏi: Vai trò của Controller?
A. Chỉ View
B. View và Model
C. Chỉ Model
Đáp án B
Giải thích: Controller nối View với Model.
`);
  assert.equal(quiz.correctKey, 'B');
  assert.equal(quiz.explanation, 'Controller nối View với Model.');
});

test('parses English "the correct answer is" keys', () => {
  const quiz = parseUnderstandingQuiz(`
Câu hỏi: Lần lặp thứ hai lấy giá trị nào?
A. apple
B. banana
C. cherry
The correct answer is B
`);
  assert.equal(quiz.correctKey, 'B');
  assert.equal(quiz.options[1].text, 'banana');
});

test('parses a trailing lone letter after the options', () => {
  const quiz = parseUnderstandingQuiz(`
Câu hỏi: Lần lặp thứ hai lấy giá trị nào?
A. apple
B. banana
C. cherry
B
`);
  assert.equal(quiz.correctKey, 'B');
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

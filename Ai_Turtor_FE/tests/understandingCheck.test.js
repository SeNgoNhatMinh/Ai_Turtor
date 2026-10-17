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

test('turns Worker Quiz tự luyện into interactive forms without leaking answers', () => {
  const extracted = extractUnderstandingCheck(`
## Theo tài liệu
Servlet xử lý HTTP.

## Quiz tự luyện

**Q1.**
Khi nào nên override doPost?
A. Khi chỉ xử lý GET
B. Khi nhận POST từ form
C. Khi deploy WAR
D. Khi dùng JSP

**Đáp án đúng:** B
**Giải thích:** POST cần doPost.

---

**Q2.**
HTTP 405 nghĩa là gì?
A. Not Found
B. Forbidden
C. Method Not Allowed
D. Server Error

**Đáp án đúng:** C
**Giải thích:** Method không được hỗ trợ.

## Học chuyên sâu
Chi tiết sâu hơn.
`);

  assert.equal(extracted.quizzes.length, 2);
  assert.equal(
    extracted.quizzes[0].options.find((option) => option.key === extracted.quizzes[0].correctKey)?.text,
    'Khi nhận POST từ form',
  );
  assert.equal(
    extracted.quizzes[1].options.find((option) => option.key === extracted.quizzes[1].correctKey)?.text,
    'Method Not Allowed',
  );
  assert.doesNotMatch(extracted.before, /Quiz tự luyện|Đáp án đúng/);
  assert.doesNotMatch(extracted.after, /Đáp án đúng|Q1|Q2/);
  assert.match(extracted.after, /Học chuyên sâu/);
});

test('parses Kiểm tra hiểu multi-item block used by Worker 2', () => {
  const extracted = extractUnderstandingCheck(`
## Giải thích
encodeURL vs encodeRedirectURL.

## Kiểm tra hiểu

Q1. Khi nào nên dùng encodeURL thay vì encodeRedirectURL?
A. Khi gửi redirect tới trình duyệt
B. Khi chuyển tiếp (forward) yêu cầu trong cùng một máy chủ
C. Khi ghi dữ liệu vào body của response
D. Khi đặt cookie
Đáp án đúng: B
Giải thích: encodeURL thêm ID session khi forward nội bộ.

Q2. encodeRedirectURL thường được sử dụng trong trường hợp nào?
A. Khi chuyển tiếp nội bộ (forward)
B. Khi gửi redirect tới client
C. Khi mã hoá tiêu đề HTTP
D. Khi mã hoá tham số truy vấn
Đáp án đúng: B
Giải thích: encodeRedirectURL thêm ID session khi redirect.

## Học chuyên sâu
- Sự khác biệt giữa encodeURL và encodeRedirectURL
`);

  assert.equal(extracted.quizzes.length, 2);
  assert.equal(
    extracted.quizzes[0].options.find((option) => option.key === extracted.quizzes[0].correctKey)?.text,
    'Khi chuyển tiếp (forward) yêu cầu trong cùng một máy chủ',
  );
  assert.equal(
    extracted.quizzes[1].options.find((option) => option.key === extracted.quizzes[1].correctKey)?.text,
    'Khi gửi redirect tới client',
  );
});

test('repairs literal backslash-n quiz payloads from JSON', () => {
  const extracted = extractUnderstandingCheck(
    '## Kiểm tra hiểu\\n\\nQ1. hỏi?\\nA. một\\nB. hai\\nC. ba\\nD. bốn\\nĐáp án đúng: B\\nGiải thích: ok\\n\\n## Học chuyên sâu\\n- tip',
  );
  assert.equal(extracted.quizzes.length, 1);
  assert.equal(
    extracted.quizzes[0].options.find((option) => option.key === extracted.quizzes[0].correctKey)?.text,
    'hai',
  );
});

test('parses deploy-mangled Quiz tự luyện with Q1.* and Đáp án đúng:*', () => {
  const extracted = extractUnderstandingCheck(`
## Giải thích
Session cookie lưu JSESSIONID.

Quiz tự luyện
Câu hỏi trắc nghiệm*
Q1.* Thuộc tính nào của cookie xác định ngày-giờ hết hạn tuyệt đối? A. Max-Age B. Secure C. Expires D. Path
Đáp án đúng:* C
Giải thích:* Thuộc tính Expires đặt ngày-giờ cụ thể khi cookie sẽ hết hạn.
Q2.* Khi muốn mã hoá URL trong thẻ a, phương thức nào? A. encodeRedirectURL B. encodeURL C. sendRedirect D. setHeader
Đáp án đúng:* B
Giải thích:* encodeURL trả về URL đã chèn Session-ID.

## Học chuyên sâu
Hiểu nguyên tắc session cookie
`);

  assert.equal(extracted.quizzes.length, 2);
  assert.match(extracted.quizzes[0].question, /hết hạn tuyệt đối/i);
  assert.equal(
    extracted.quizzes[0].options.find((option) => option.key === extracted.quizzes[0].correctKey)?.text,
    'Expires',
  );
  assert.equal(
    extracted.quizzes[1].options.find((option) => option.key === extracted.quizzes[1].correctKey)?.text,
    'encodeURL',
  );
  assert.doesNotMatch(extracted.before, /Đáp án đúng|Q1/);
  assert.match(extracted.after, /Học chuyên sâu/);
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

test('preserves technical option text wrapped as Markdown code', () => {
  const quiz = parseUnderstandingQuiz(`
Câu hỏi: Toán tử nào được dùng để lấy địa chỉ của một biến?
A. \`*\`
B. \`&\`
C. \`=\`
Đáp án: B
Giải thích: Toán tử \`&\` lấy địa chỉ của biến.
`);

  assert.ok(quiz);
  assert.deepEqual(
    new Set(quiz.options.map((option) => option.text)),
    new Set(['*', '&', '=']),
  );
  assert.equal(quiz.options.find((option) => option.key === quiz.correctKey)?.text, '&');
  assert.equal(quiz.explanation, 'Toán tử & lấy địa chỉ của biến.');
});

test('preserves punctuation in technical answers while removing only wrappers', () => {
  const quiz = parseUnderstandingQuiz(`
Question: Which declaration is valid?
A. \`int *p\`
B. \`!=\`
C. \`_value\`
D. \`a[i]\`
Answer: A
`);

  assert.ok(quiz);
  assert.deepEqual(
    new Set(quiz.options.map((option) => option.text)),
    new Set(['int *p', '!=', '_value', 'a[i]']),
  );
  assert.equal(quiz.options.find((option) => option.key === quiz.correctKey)?.text, 'int *p');
});

test('keeps the correct answer mapped to its option after deterministic shuffle', () => {
  const quiz = parseUnderstandingQuiz(`
Question: Which operator takes an address?
A. \`*\`
B. \`&\`
C. \`=\`
Answer: B
`);

  const correctOption = quiz.options.find((option) => option.key === quiz.correctKey);
  assert.deepEqual(correctOption, { key: quiz.correctKey, text: '&' });
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
  assert.equal(
    extracted.quiz.options.find((option) => option.key === extracted.quiz.correctKey)?.text,
    'banana',
  );
  assert.equal(extracted.quiz.explanation, 'Index 1 là banana.');
  assert.ok(extracted.quiz.options.some((option) => option.text === 'banana'));
});

test('hides an inline answer and explanation leaked into the last option', () => {
  const extracted = extractUnderstandingCheck(`
## Kiểm tra hiểu
Câu hỏi: Khi một Servlet được tải lần đầu, phương thức nào được gọi đầu tiên?
A. service() xử lý HTTP ngay lập tức
B. init() thiết lập tài nguyên cần thiết
C. destroy() giải phóng tài nguyên. **Giải thích:** init() được gọi ngay sau khi Servlet được khởi tạo. **Đáp án:** B **Giải thích:** init() chuẩn bị tài nguyên.
`);

  assert.match(
    extracted.quiz.options.find((option) => option.key === extracted.quiz.correctKey)?.text || '',
    /^init\(\)/,
  );
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

  assert.equal(
    extracted.quiz.options.find((option) => option.key === extracted.quiz.correctKey)?.text,
    'init()',
  );
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
  assert.equal(quiz.options.find((option) => option.key === quiz.correctKey)?.text, 'banana');
});

test('parses a trailing lone letter after the options', () => {
  const quiz = parseUnderstandingQuiz(`
Câu hỏi: Lần lặp thứ hai lấy giá trị nào?
A. apple
B. banana
C. cherry
B
`);
  assert.equal(quiz.options.find((option) => option.key === quiz.correctKey)?.text, 'banana');
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

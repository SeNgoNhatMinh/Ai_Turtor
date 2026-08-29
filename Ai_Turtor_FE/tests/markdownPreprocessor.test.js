import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAiMarkdown, stripSourceSection } from '../src/utils/markdownPreprocessor.js';

test('preserves valid Vietnamese diacritics and normalizes Unicode to NFC', () => {
  const decomposed = 'Ví dụ nhỏ'.normalize('NFD');
  const input = `${decomposed}\n\nConstructor là phương thức đặc biệt để khởi tạo đối tượng.`;
  const output = normalizeAiMarkdown(input);

  assert.match(output, /^### Ví dụ nhỏ/m);
  assert.match(output, /Constructor là phương thức đặc biệt để khởi tạo đối tượng\./);
  assert.equal(output, output.normalize('NFC'));
});

test('repairs mojibake before markdown rendering', () => {
  const broken = 'Lá»—i mÃ¡y chá»§: AI Tutor chÆ°a thá»ƒ gá»i dá»‹ch vá»¥ LLM. Vui lÃ²ng thá»­ láº¡i sau.';

  assert.equal(
    normalizeAiMarkdown(broken),
    'Lỗi máy chủ: AI Tutor chưa thể gọi dịch vụ LLM. Vui lòng thử lại sau.',
  );
});

test('normalizes known backend Code Mentor headings without rewriting body meaning', () => {
  const input = [
    '## Chan doan van de',
    'Servlet đang nhận request.',
    '',
    '## Nguyen nhan co the',
    'Thiếu cấu hình mapping.',
    '',
    '## Cach debug tung buoc',
    'Kiểm tra annotation.',
    '',
    '## Goi y sua',
    'Sửa mapping.',
    '',
    '## Chu de nen on lai',
    'Servlet lifecycle.',
  ].join('\n');
  const output = normalizeAiMarkdown(input);

  assert.match(output, /## Chẩn đoán vấn đề/);
  assert.match(output, /## Nguyên nhân có thể/);
  assert.match(output, /## Cách debug từng bước/);
  assert.match(output, /## Gợi ý sửa/);
  assert.match(output, /## Chủ đề nên ôn lại/);
  assert.match(output, /Servlet đang nhận request\./);
});

test('does not guess diacritics for arbitrary unaccented AI content', () => {
  const raw = 'Day la cau tra loi cua AI ve mot khai niem chua du ngu canh.';
  assert.equal(normalizeAiMarkdown(raw), raw);
});

test('never rewrites fenced code, including partial streaming fences', () => {
  const closed = [
    'Theo tai lieu mon hoc',
    '',
    '```text',
    'Tai lieu mon hoc',
    '1.item',
    '$not math$',
    '```',
    '',
    'Luu y de hoc tot hon',
  ].join('\n');
  const partial = ['```text', 'Tai lieu mon hoc', '1.item'].join('\n');

  const normalizedClosed = normalizeAiMarkdown(closed);
  assert.match(normalizedClosed, /### Theo tài liệu môn học/);
  assert.match(normalizedClosed, /```text\nTai lieu mon hoc\n1\.item\n\$not math\$\n```/);
  assert.match(normalizedClosed, /### Lưu ý để học tốt hơn/);
  assert.equal(normalizeAiMarkdown(partial), partial);
});

test('does not turn plus signs inside inline code into list items', () => {
  const input = '- Mở **Settings** (`File ➪ Settings` hoặc `Ctrl + Alt + S`).';
  const output = normalizeAiMarkdown(input);

  assert.equal(output, input);
  assert.match(output, /`Ctrl \+ Alt \+ S`/);
  assert.doesNotMatch(output, /Ctrl\n\+ Alt/);
});

test('preserves arithmetic expressions inside list items', () => {
  const input = [
    '- **b. Tổng số thanh ghi:** tổng = (1 + 3) + (3 + 4) = **11** thanh ghi.',
    '- **c. Số địa chỉ:** 5 + 7 = **12** địa chỉ.',
  ].join('\n');

  const output = normalizeAiMarkdown(input);

  assert.equal(output, input);
  assert.doesNotMatch(output, /\n\+\s/);
});

test('repairs list markers only when they start a line', () => {
  const input = ['-mục một', '+mục hai', '1.mục ba'].join('\n');

  assert.equal(
    normalizeAiMarkdown(input),
    ['- mục một', '- mục hai', '1. mục ba'].join('\n'),
  );
});

test('markdown normalization is idempotent', () => {
  const once = normalizeAiMarkdown('Theo tai lieu mon hoc\n\n- Constructor là gì?');
  assert.equal(normalizeAiMarkdown(once), once);
});

test('merges duplicate bold source sections and repeated PDF suffixes', () => {
  const input = [
    'Nội dung trả lời.',
    '',
    '**Nguồn tài liệu đã dùng**',
    '**Nguồn tài liệu đã dùng**',
    '**Professional\\_Java\\_for\\_Web\\_Applications.pdf.pdf.pdf**',
    '**Professional\\_Java\\_for\\_Web\\_Applications.pdf.pdf**',
    '**Professional\\_Java\\_for\\_Web\\_Applications.pdf.pdf.pdf**',
  ].join('\n\n');

  const output = normalizeAiMarkdown(input);

  assert.equal((output.match(/Nguồn tài liệu đã dùng/g) || []).length, 1);
  assert.equal((output.match(/Professional_Java_for_Web_Applications\.pdf/g) || []).length, 1);
  assert.doesNotMatch(output, /\.pdf\.pdf/i);
  assert.equal(stripSourceSection(output), 'Nội dung trả lời.');
});

test('repairs fake TABLE caption and ASCII dash rows into a ChatGPT-style GFM table', () => {
  const input = [
    'JSP thông thường so với JSPX:',
    '',
    '| JSPX (XML) |',
    '',
    'TABLE',
    '| ---------------- | -------- |',
    '| <%@ page ... %> | <jsp:directive.page /> |',
    '| <%! ... %> | <jsp:declaration> ... </jsp:declaration> |',
  ].join('\n');

  const output = normalizeAiMarkdown(input);

  assert.doesNotMatch(output, /^TABLE$/m);
  assert.doesNotMatch(output, /^\| JSPX \(XML\) \|$/m);
  assert.match(output, /^\| Cột 1 \| Cột 2 \|$/m);
  assert.match(output, /^\| --- \| --- \|$/m);
  assert.match(output, /`<%@ page \.\.\. %>`/);
  assert.match(output, /`<jsp:directive\.page \/>`/);
});

test('keeps a normal markdown table header', () => {
  const input = [
    '| JSP | JSPX |',
    '| --- | --- |',
    '| `<%@ page %>` | `<jsp:directive.page />` |',
  ].join('\n');

  const output = normalizeAiMarkdown(input);

  assert.match(output, /^\| JSP \| JSPX \|$/m);
  assert.doesNotMatch(output, /Cột 1/);
});

test('keeps course-material answers that mention a PDF in prose', () => {
  const input = [
    '## Theo tài liệu môn học',
    '',
    'OOP (Object-Oriented Programming) là lập trình hướng đối tượng. Tài liệu PRO192.pdf nêu class, object, inheritance.',
    '',
    '## Lưu ý để học tốt hơn',
    '',
    '- Xem các chương về class, object',
    '',
    '## Nguồn tài liệu đã dùng',
    '',
    '- PRO192.pdf',
  ].join('\n');

  const output = normalizeAiMarkdown(input);
  const visible = stripSourceSection(output);

  assert.match(visible, /OOP \(Object-Oriented Programming\) là lập trình hướng đối tượng/);
  assert.match(visible, /Theo tài liệu môn học/);
  assert.match(visible, /Lưu ý để học tốt hơn/);
  assert.doesNotMatch(visible, /Nguồn tài liệu đã dùng/);
});

test('turns Bài tiếp theo into a clickable study-tip link', () => {
  const output = normalizeAiMarkdown([
    '## Bài tiếp theo',
    '',
    '- Bài 2 – Sử dụng biến lặp (itervar) trong thân vòng.',
  ].join('\n'));

  assert.match(output, /## Bài tiếp theo/);
  assert.match(output, /\[Bài 2 – Sử dụng biến lặp \(itervar\) trong thân vòng\.\]\(#ai-study-tip-1\)/);
});

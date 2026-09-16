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

test('turns Học tiếp phần này bullets into clickable study-tip links', () => {
  const output = normalizeAiMarkdown([
    '## Học tiếp phần này',
    '',
    '- Cache L3 dùng chung giữa các core khác với L2 riêng từng core thế nào',
    '- False sharing khi hai core ghi cache line gần nhau',
  ].join('\n'));

  assert.match(output, /## Học tiếp phần này/);
  assert.match(output, /\[Cache L3 dùng chung giữa các core khác với L2 riêng từng core thế nào\]\(#ai-study-tip-1\)/);
});

test('turns Học chuyên sâu bullets into clickable study-tip links', () => {
  const output = normalizeAiMarkdown([
    '## Học chuyên sâu',
    '',
    '- Cache miss khi CPU không tìm thấy dữ liệu',
    '- Buffer cache của OS khi đọc file',
  ].join('\n'));

  assert.match(output, /## Học chuyên sâu/);
  assert.match(output, /\[Cache miss khi CPU không tìm thấy dữ liệu\]\(#ai-study-tip-1\)/);
  assert.match(output, /\[Buffer cache của OS khi đọc file\]\(#ai-study-tip-2\)/);
});

test('removes punctuation-only placeholders from study tips', () => {
  const output = normalizeAiMarkdown([
    '## Lưu ý để học tốt hơn',
    '',
    '1. Ôn lại vòng đời Servlet.',
    '- --',
    '---',
  ].join('\n'));

  assert.match(output, /Ôn lại vòng đời Servlet/);
  assert.doesNotMatch(output, /\]\(#ai-study-tip-2\)/);
  assert.doesNotMatch(output, /^\s*[-*+]\s+--\s*$/m);
});

test('strips prompt narration from a broken Bài tiếp theo section', () => {
  const output = normalizeAiMarkdown([
    '## Kiểm tra hiểu',
    'Câu hỏi: TLD dùng để làm gì?',
    '',
    '## Bài tiếp theo',
    '(Omit as per instruction: "Name the next Bài only when teaching a numbered lesson path; otherwise omit." I don\'t have a numbered path provided, so I\'ll omit it to be safe, or I can just include the heading.)',
    '- Wait, the prompt says:',
    '- "## Bài tiếp theo',
  ].join('\n'));

  assert.doesNotMatch(output, /the prompt says/i);
  assert.doesNotMatch(output, /Omit as per/i);
  assert.doesNotMatch(output, /## Bài tiếp theo/);
  assert.match(output, /Kiểm tra hiểu/);
});

test('normal concept answers do not keep a numbered Bài 1-2-3 follow-up', () => {
  const output = normalizeAiMarkdown([
    '## Theo tài liệu môn học',
    'OOP gom dữ liệu và hành vi vào đối tượng.',
    '',
    '## Bài tiếp theo',
    '- Bài 1: Tổng quan OOP',
    '- Bài 2: Kế thừa',
    '',
    '## Lưu ý để học tốt hơn',
    '- Ôn encapsulation',
  ].join('\n'));

  assert.doesNotMatch(output, /## Bài tiếp theo/);
  assert.doesNotMatch(output, /Bài 1: Tổng quan OOP/);
  assert.match(output, /Ôn encapsulation/);
});

test('splits long plain prose answers into readable paragraphs', () => {
  const input = [
    '## Giải thích',
    '',
    'Bài học này mở rộng nền tảng về subroutine đã được nêu trong tài liệu, khi sinh viên đã học cách viết các hàm thực hiện thao tác dữ liệu và điều khiển luồng chương trình. Việc truyền tham số bằng con trỏ cho phép hàm truy cập trực tiếp vào vùng nhớ của biến gốc, thay vì làm việc trên một bản sao, điều này mở rộng khả năng thao tác dữ liệu mà trước đây chỉ được giới hạn ở việc truyền giá trị. Khi hàm nhận con trỏ làm tham số, nó có thể thay đổi giá trị của biến mà gọi hàm đã truyền vào, vì con trỏ giữ địa chỉ bộ nhớ thực tế của biến đó. Điều này phù hợp với nguyên tắc data manipulation được nhấn mạnh trong phần giới thiệu, nơi sinh viên được khuyến khích hiểu sâu về cách dữ liệu được lưu trữ và truy cập trong máy tính. Các hàm trả về con trỏ cung cấp một cách để cấp phát và trả về địa chỉ của dữ liệu được tạo bên trong hàm, cho phép các hàm khác tiếp tục sử dụng dữ liệu đó mà không cần sao chép toàn bộ cấu trúc.',
  ].join('\n');

  const output = normalizeAiMarkdown(input);

  assert.match(output, /## Giải thích/);
  assert.match(output, /vùng nhớ của biến gốc[\s\S]*\n\nKhi hàm nhận con trỏ làm tham số/);
  assert.match(output, /truy cập trong máy tính\.[\s\S]*\n\nCác hàm trả về con trỏ/);
});

test('does not split long markdown structures that are sensitive to line breaks', () => {
  const row = 'Đây là phần mô tả khá dài để bảo đảm bảng vượt qua ngưỡng văn xuôi nhưng vẫn phải giữ nguyên cấu trúc markdown của bảng.';
  const input = [
    '| Chủ đề | Mô tả |',
    '| --- | --- |',
    `| Con trỏ | ${row} ${row} ${row} |`,
  ].join('\n');

  const output = normalizeAiMarkdown(input);

  assert.match(output, /^\| Chủ đề \| Mô tả \|$/m);
  assert.match(output, /^\| --- \| --- \|$/m);
  assert.doesNotMatch(output, /\n\n\| Con trỏ/);
});

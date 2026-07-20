import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAiMarkdown } from '../src/utils/markdownPreprocessor.js';

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

test('markdown normalization is idempotent', () => {
  const once = normalizeAiMarkdown('Theo tai lieu mon hoc\n\n- Constructor là gì?');
  assert.equal(normalizeAiMarkdown(once), once);
});

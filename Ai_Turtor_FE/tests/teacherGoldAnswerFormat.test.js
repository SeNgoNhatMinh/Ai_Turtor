import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTeacherGoldAnswer } from '../src/utils/teacherGoldAnswerFormat.js';

test('wraps sloppy JSP snippets as inline code', () => {
  const output = formatTeacherGoldAnswer(
    'JSPX la JSP viet bang XML. Vi du: <%@ page language="java" %> khac <jsp:root>.',
  );

  assert.match(output, /`<%@ page language="java" %>`/);
  assert.match(output, /`<jsp:root>`/);
});

test('breaks a jammed teacher paragraph into readable sentences', () => {
  const output = formatTeacherGoldAnswer(
    'JSPX là JSP viết bằng XML. Chúng dùng thẻ XML thay vì scriptlet. Cú pháp: file phải well-formed.',
  );

  assert.match(output, /^- JSPX là JSP viết bằng XML\./m);
  assert.match(output, /^- Chúng dùng thẻ XML thay vì scriptlet\./m);
  assert.match(output, /Cú pháp: file phải well-formed/);
});

test('turns informal labels into section headings', () => {
  const output = formatTeacherGoldAnswer('Cú pháp: JSP dùng <%@ page %>.');
  assert.match(output, /### Cú pháp/);
  assert.match(output, /`<%@ page %>`/);
});

test('keeps an already formatted markdown answer', () => {
  const input = '## Định nghĩa\n\nJSPX là JSP dạng XML.\n\nVí dụ: `<%@ page %>`';
  const output = formatTeacherGoldAnswer(input);
  assert.match(output, /JSPX là JSP dạng XML/);
  assert.match(output, /`<%@ page %>`/);
});

test('turns multiline teacher points into a bullet list', () => {
  const output = formatTeacherGoldAnswer(
    'JSPX là dạng XML của JSP, thường đuôi .jspx, phải tuân thủ XML\n'
    + 'Dễ phát hiện lỗi lúc compile hơn runtime\n'
    + 'Ít phổ biến hơn JSP thường -> ít ví dụ cộng đồng hơn\n'
    + 'Sách chỉ giới thiệu khác biệt rồi chủ yếu dùng JSP thường',
  );

  assert.match(output, /^- JSPX là dạng XML/m);
  assert.match(output, /^- Dễ phát hiện lỗi/m);
  assert.match(output, /^- Ít phổ biến hơn/m);
  assert.match(output, /^- Sách chỉ giới thiệu/m);
  assert.match(output, /`\.jspx`/);
});

test('splits jammed Vietnamese clauses into bullets', () => {
  const output = formatTeacherGoldAnswer(
    'JSPX là dạng XML của JSP, thường đuôi .jspx, phải tuân thủ XML '
    + 'Dễ phát hiện lỗi lúc compile hơn runtime '
    + 'Ít phổ biến hơn JSP thường -> ít ví dụ cộng đồng hơn '
    + 'Sách chỉ giới thiệu khác biệt rồi chủ yếu dùng JSP thường',
  );

  assert.match(output, /^- JSPX là dạng XML/m);
  assert.match(output, /^- Dễ phát hiện lỗi/m);
  assert.match(output, /^- Ít phổ biến hơn/m);
  assert.match(output, /^- Sách chỉ giới thiệu/m);
});

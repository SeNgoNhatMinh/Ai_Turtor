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

  assert.match(output, /JSPX là JSP viết bằng XML\.\n\n/);
  assert.match(output, /Chúng dùng thẻ XML thay vì scriptlet\./);
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

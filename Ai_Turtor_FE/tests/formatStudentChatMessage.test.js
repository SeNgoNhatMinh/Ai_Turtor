import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatStudentChatMessage,
  isExplodedMarkup,
  reconstructExplodedMarkup,
} from '../src/utils/formatStudentChatMessage.js';

const explodedJspx = `
code này đúng chưa và nó xuất ra màn hình là gì ?
<
jsp:
root
xmlns:
jsp
=
"
http://java.sun.com/JSP/Page
"
version
=
"
2.0
"
>
<jsp:scriptlet>counter++;</jsp:scriptlet>
</
jsp:
root
>
`;

test('detects exploded JSPX paste', () => {
  assert.equal(isExplodedMarkup(explodedJspx), true);
  assert.equal(isExplodedMarkup('Servlet là gì?'), false);
});

test('reconstructs exploded tags into readable source', () => {
  const rebuilt = reconstructExplodedMarkup(explodedJspx);
  assert.match(rebuilt, /<jsp:root/);
  assert.match(rebuilt, /xmlns:jsp="http:\/\/java.sun.com\/JSP\/Page"/);
  assert.match(rebuilt, /" version="/);
  assert.doesNotMatch(rebuilt, /<\s+jsp:/);
});

test('pretty-prints student JSPX onto separate lines', () => {
  const { code } = formatStudentChatMessage(explodedJspx);
  assert.match(code, /<jsp:root xmlns:jsp="http:\/\/java.sun.com\/JSP\/Page" version="2.0">/);
  assert.match(code, /\n\s*<jsp:scriptlet>/);
  assert.match(code, /\n<\/jsp:root>/);
  assert.doesNotMatch(code, /Page"version=/);
});

test('splits the student question from the pasted source', () => {
  const { prose, code } = formatStudentChatMessage(explodedJspx);
  assert.match(prose, /đúng chưa/i);
  assert.match(code, /<jsp:root/);
  assert.doesNotMatch(code, /đúng chưa/i);
});

test('keeps a plain question as prose', () => {
  const { prose, code } = formatStudentChatMessage('Servlet là gì?');
  assert.equal(prose, 'Servlet là gì?');
  assert.equal(code, '');
});

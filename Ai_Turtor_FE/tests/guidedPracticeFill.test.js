import test from 'node:test';
import assert from 'node:assert/strict';
import { extractGuidedPractice, filledPracticeMessage } from '../src/features/student/chat/guidedPracticeFill.js';

test('turns the guided-practice blank into a fillable span', () => {
  const practice = extractGuidedPractice(`
## 1. Giải thích khái niệm

Servlet nhận request.

## 2. Bài tập có hướng dẫn

Điền tên method còn thiếu.

\`\`\`java
public class HelloServlet extends HttpServlet {
  protected void ____(HttpServletRequest req, HttpServletResponse resp) {}
}
\`\`\`

## 3. Tự thực hành

Hãy nói method đó làm gì.
`);

  assert.equal(practice.token, '____');
  assert.match(practice.before, /Servlet nhận request/);
  assert.match(practice.after, /Tự thực hành/);
  assert.match(practice.prose, /Điền tên method/);
  assert.match(
    filledPracticeMessage(practice, 'doGet'),
    /protected void doGet\(HttpServletRequest/,
  );
});

test('fills every blank in the guided practice skeleton', () => {
  const practice = extractGuidedPractice(`
## 5. Bài tập có hướng dẫn

\`\`\`java
protected void ____(HttpServletRequest ____, HttpServletResponse resp) {}
\`\`\`
`);

  assert.equal(practice.blankCount, 2);
  assert.match(
    filledPracticeMessage(practice, ['doGet', 'req']),
    /protected void doGet\(HttpServletRequest req, HttpServletResponse resp\)/,
  );
  assert.equal(filledPracticeMessage(practice, ['doGet']), '');
});

test('still offers a fill when the skeleton has no blank token', () => {
  const practice = extractGuidedPractice(`
## 5. Bài tập có hướng dẫn

\`\`\`java
int sum = a + b;
\`\`\`
`);
  assert.equal(practice.token, '');
  assert.match(filledPracticeMessage(practice, 'return a + b;'), /Chỗ mình điền: return a \+ b;/);
});

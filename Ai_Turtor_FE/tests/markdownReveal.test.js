import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextRevealIndex,
  revealSourceMarkdown,
  revealStepSize,
  shouldRevealAnswer,
} from '../src/features/student/chat/markdownReveal.js';

test('streams the lesson body and holds the understanding-check section until the end', () => {
  const markdown = [
    'Cache L2 chia sẻ giúp các core đọc dữ liệu đã có sẵn.',
    '',
    '## Kiểm tra hiểu',
    'Câu hỏi: L2 chia sẻ giúp gì?',
    'A. Giảm độ trễ',
    'B. Xóa RAM',
    'Đáp án: A',
    'Giải thích: Core khác đọc được ngay.',
  ].join('\n');

  assert.equal(
    revealSourceMarkdown(markdown),
    'Cache L2 chia sẻ giúp các core đọc dữ liệu đã có sẵn.',
  );
  assert.equal(shouldRevealAnswer({ enabled: true, markdown }), true);
  assert.equal(shouldRevealAnswer({ enabled: false, markdown }), false);
  assert.equal(shouldRevealAnswer({ enabled: true, markdown, reducedMotion: true }), false);
});

test('does not animate a tiny reply', () => {
  assert.equal(shouldRevealAnswer({ enabled: true, markdown: 'OK.' }), false);
});

test('advances in readable chunks instead of one character', () => {
  const full = 'Servlet là Java component chạy trên máy chủ web để xử lý request.';
  const step = revealStepSize(full.length);
  assert.ok(step >= 6);
  const next = nextRevealIndex(full, 0, step);
  assert.ok(next > step - 1);
  assert.ok(next <= full.length);
  assert.equal(nextRevealIndex(full, full.length - 2, 80), full.length);
});

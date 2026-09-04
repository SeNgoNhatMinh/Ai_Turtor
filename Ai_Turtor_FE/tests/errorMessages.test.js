import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_SERVICE_ERROR_MESSAGE,
  isAiServiceErrorText,
  shouldOfferLessonContinuations,
} from '../src/utils/errorMessages.js';

test('busy tutor notices are treated as failed turns, not study continuations', () => {
  assert.equal(isAiServiceErrorText('Mình đang xử lý hơi chậm một chút. Bạn thử hỏi lại sau vài giây.'), true);
  assert.equal(isAiServiceErrorText('Mình chưa soạn xong ý này từ tài liệu.'), true);
  assert.equal(shouldOfferLessonContinuations({
    question: 'Đào sâu bài 4: Cache L2/L3',
    answer: 'Mình chưa soạn xong ý này từ tài liệu. Bạn bấm Thử lại giúp mình nhé.',
  }), false);
  assert.equal(shouldOfferLessonContinuations({
    question: 'Bắt đầu bài 4: Cache',
    answer: '## Giải thích\nCache giúp CPU đọc dữ liệu nhanh hơn.',
  }), true);
});

test('student-facing service notice does not mention language models or outages', () => {
  assert.doesNotMatch(AI_SERVICE_ERROR_MESSAGE, /mô hình ngôn ngữ|llm|kết nối|hệ thống hỏng/i);
  assert.match(AI_SERVICE_ERROR_MESSAGE, /Thử lại/);
});

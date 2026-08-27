import assert from 'node:assert/strict';
import test from 'node:test';
import { getCanonicalMessageSources } from '../src/features/student/chat/chatMessageUtils.js';
import { buildMaterialSourceMap } from '../src/utils/sourceLabels.js';

test('uses one canonical source when chat history contains the same source in metadata and Markdown', () => {
  const materialId = '6a3d56a6ad3e666fbe4566ee';
  const sourceMap = buildMaterialSourceMap([{
    materialId,
    fileName: 'Professional_Java.pdf.pdf.pdf',
  }]);
  const message = {
    sources: [
      { materialId, fileName: 'Professional_Java.pdf.pdf' },
      'Professional_Java.pdf',
    ],
    answer: [
      'Nội dung trả lời.',
      '**Nguồn tài liệu đã dùng**',
      '**Professional\\_Java.pdf**',
      '**Professional\\_Java.pdf**',
    ].join('\n\n'),
  };

  assert.deepEqual(getCanonicalMessageSources(message, sourceMap), [{
    id: materialId,
    label: 'Professional_Java.pdf',
  }]);
});

test('recovers a source from persisted answer content when history has no source metadata', () => {
  const message = {
    answer: [
      'Nội dung trả lời.',
      '### Nguồn tài liệu đã dùng',
      '- Java_Core.pdf',
    ].join('\n\n'),
  };

  assert.deepEqual(getCanonicalMessageSources(message), [{
    id: '',
    label: 'Java_Core.pdf',
  }]);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMaterialSourceMap,
  extractAnswerSourceLabels,
  formatSourceItems,
  isMaterialSourceText,
  normalizeSourceDisplayName,
} from '../src/utils/sourceLabels.js';

test('normalizes repeated file suffixes without losing the readable filename', () => {
  assert.equal(
    normalizeSourceDisplayName('**Professional\\_Java.pdf.pdf.pdf**'),
    'Professional_Java.pdf',
  );
});

test('extracts one source from a persisted answer with duplicated Markdown entries', () => {
  const answer = [
    'Nội dung trả lời.',
    '**Nguồn tài liệu đã dùng**',
    '**Professional\\_Java.pdf**',
    '**Professional\\_Java.pdf**',
  ].join('\n\n');

  assert.deepEqual(extractAnswerSourceLabels(answer), ['Professional_Java.pdf']);
});

test('deduplicates normalized source labels and preserves a downloadable material id', () => {
  const sourceMap = buildMaterialSourceMap([{
    materialId: '6a3d56a6ad3e666fbe4566ee',
    fileName: 'Professional_Java.pdf.pdf.pdf',
  }]);
  const sources = formatSourceItems([
    'Professional_Java.pdf.pdf',
    { materialId: '6a3d56a6ad3e666fbe4566ee', fileName: 'Professional_Java.pdf.pdf.pdf' },
    '**Professional\\_Java.pdf**',
  ], sourceMap);

  assert.deepEqual(sources, [{
    id: '6a3d56a6ad3e666fbe4566ee',
    label: 'Professional_Java.pdf',
  }]);
});

test('treats only dedicated citation lines as material source text', () => {
  assert.equal(isMaterialSourceText('PRO192.pdf'), true);
  assert.equal(isMaterialSourceText('materialId=6a3d56a6ad3e666fbe4566ee'), true);
  assert.equal(isMaterialSourceText('6a3d56a6ad3e666fbe4566ee'), true);
  assert.equal(isMaterialSourceText('Tài liệu: PRO192.pdf'), true);

  assert.equal(
    isMaterialSourceText(
      'OOP (Object-Oriented Programming) là lập trình hướng đối tượng. Tài liệu PRO192.pdf nêu class, object, inheritance.',
    ),
    false,
  );
  assert.equal(
    isMaterialSourceText('OOP là lập trình hướng đối tượng theo slide Chapter1.pptx của môn PRO192.'),
    false,
  );
  assert.equal(
    isMaterialSourceText('OOP là lập trình hướng đối tượng. Nguồn 6a3d56a6ad3e666fbe4566ee.'),
    false,
  );
});

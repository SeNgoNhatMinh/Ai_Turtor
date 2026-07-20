import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasBrokenTextEncoding,
  normalizeUnicodeText,
  repairMojibake,
} from '../src/utils/textEncoding.js';

test('repairs a mojibake Vietnamese conversation title', () => {
  const brokenTitle = 'Cuá»™c trÃ² chuyá»‡n má»›i';

  assert.equal(repairMojibake(brokenTitle), 'Cuộc trò chuyện mới');
  assert.equal(hasBrokenTextEncoding(brokenTitle), true);
});

test('keeps valid Vietnamese text unchanged', () => {
  const title = 'Cuộc trò chuyện mới';

  assert.equal(repairMojibake(title), title);
  assert.equal(hasBrokenTextEncoding(title), false);
});

test('normalizes decomposed Vietnamese text to Unicode NFC', () => {
  const decomposed = 'Lưu ý để học tốt hơn'.normalize('NFD');

  assert.equal(normalizeUnicodeText(decomposed), 'Lưu ý để học tốt hơn');
});

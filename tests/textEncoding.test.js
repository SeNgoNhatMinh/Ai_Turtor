import test from 'node:test';
import assert from 'node:assert/strict';
import { hasBrokenTextEncoding, repairMojibake } from '../src/utils/textEncoding.js';

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

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCachedResource,
  getResourceCacheSize,
  invalidateResourceCache,
} from '../src/services/requestCache.js';

test('deduplicates pending reads and reuses cached values', async () => {
  invalidateResourceCache();
  let calls = 0;
  const loader = async () => {
    calls += 1;
    return { value: calls };
  };
  const [first, second] = await Promise.all([
    getCachedResource('courses:student-1', loader),
    getCachedResource('courses:student-1', loader),
  ]);
  const third = await getCachedResource('courses:student-1', loader);

  assert.equal(calls, 1);
  assert.deepEqual(first, second);
  assert.deepEqual(second, third);
  assert.equal(getResourceCacheSize(), 1);
});

test('supports forced reads and prefix invalidation', async () => {
  invalidateResourceCache();
  let calls = 0;
  const loader = async () => ++calls;

  await getCachedResource('quiz:student-1', loader);
  assert.equal(await getCachedResource('quiz:student-1', loader, { force: true }), 2);
  invalidateResourceCache('quiz:');
  assert.equal(getResourceCacheSize(), 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearServerQueryCache,
  fetchServerQuery,
  getServerQueryCacheSize,
  invalidateServerQueries,
} from '../src/services/queryCache.js';

test('deduplicates pending reads and reuses cached values', async () => {
  clearServerQueryCache();
  let calls = 0;
  const loader = async () => {
    calls += 1;
    return { value: calls };
  };
  const [first, second] = await Promise.all([
    fetchServerQuery(['courses', 'student-1'], loader),
    fetchServerQuery(['courses', 'student-1'], loader),
  ]);
  const third = await fetchServerQuery(['courses', 'student-1'], loader);

  assert.equal(calls, 1);
  assert.deepEqual(first, second);
  assert.deepEqual(second, third);
  assert.equal(getServerQueryCacheSize(), 1);
});

test('supports forced reads and prefix invalidation', async () => {
  clearServerQueryCache();
  let calls = 0;
  const loader = async () => ++calls;

  await fetchServerQuery(['quiz', 'student-1'], loader);
  assert.equal(await fetchServerQuery(['quiz', 'student-1'], loader, { force: true }), 2);
  await invalidateServerQueries(['quiz']);
  clearServerQueryCache();
  assert.equal(getServerQueryCacheSize(), 0);
});

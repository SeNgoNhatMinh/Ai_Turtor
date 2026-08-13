import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesCollectionQuery } from '../src/hooks/useCollectionView.js';

test('collection search ignores Vietnamese accents and letter case', () => {
  const record = { courseId: 'PRJ301', courseName: 'Ứng dụng Web Java' };
  assert.equal(matchesCollectionQuery(record, 'ung dung web'), true);
  assert.equal(matchesCollectionQuery(record, 'prj301'), true);
});

test('collection search can be restricted to business fields', () => {
  const record = { title: 'Java Core', internalSecret: 'hidden-value' };
  assert.equal(matchesCollectionQuery(record, 'java', ['title']), true);
  assert.equal(matchesCollectionQuery(record, 'hidden', ['title']), false);
});

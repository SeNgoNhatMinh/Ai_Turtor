import assert from 'node:assert/strict';
import test from 'node:test';
import { getCourseSelectOptions } from '../src/pages/admin/academic/adminAcademicUtils.js';

test('builds stable Ant Design course options from either courseId or id', () => {
  assert.deepEqual(
    getCourseSelectOptions([
      { courseId: 'PRJ301', courseName: 'Java Web' },
      { id: 'PRO192', courseName: 'Object-Oriented Programming' },
      { courseName: 'Missing identifier' },
    ]),
    [
      { value: 'PRJ301', label: 'PRJ301 - Java Web' },
      { value: 'PRO192', label: 'PRO192 - Object-Oriented Programming' },
    ],
  );
});

test('returns no options for a malformed course response', () => {
  assert.deepEqual(getCourseSelectOptions(null), []);
  assert.deepEqual(getCourseSelectOptions({ content: [] }), []);
});

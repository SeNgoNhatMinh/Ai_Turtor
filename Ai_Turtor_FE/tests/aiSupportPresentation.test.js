import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLearningOverview,
  buildTeachingApproaches,
  supportLevelPlainLabel,
} from '../src/features/student/learning/aiSupportPresentation.js';

test('learning overview keeps only provided evidence', () => {
  const overview = buildLearningOverview({
    masteredTopics: ['Servlet'],
    improveTopics: ['Session'],
    recentResults: ['Đã hỏi: MVC là gì?'],
    updatedAt: '2026-11-08T00:00:00.000Z',
  });
  assert.deepEqual(overview.masteredTopics, ['Servlet']);
  assert.deepEqual(overview.improveTopics, ['Session']);
  assert.equal(overview.recentResults.length, 1);
  assert.ok(overview.updatedAt);
});

test('empty learning overview does not invent topics', () => {
  const overview = buildLearningOverview({});
  assert.deepEqual(overview.masteredTopics, []);
  assert.deepEqual(overview.improveTopics, []);
  assert.deepEqual(overview.recentResults, []);
  assert.equal(overview.updatedAt, '');
});

test('teaching approaches map from support level into plain labels', () => {
  const approaches = buildTeachingApproaches({
    supportLevel: 'HIGH_SUPPORT',
    improveTopics: ['JSP'],
  });
  assert.deepEqual(approaches.map((item) => item.title), [
    'Giải thích từng bước',
    'Luyện tập có hướng dẫn',
  ]);
  assert.match(approaches[0].description, /JSP/);
});

test('challenge support level surfaces thử thách kiến thức', () => {
  const approaches = buildTeachingApproaches({
    supportLevel: 'CHALLENGE',
    masteredTopics: ['MVC'],
  });
  assert.equal(approaches[0].title, 'Thử thách kiến thức');
  assert.match(approaches[0].description, /MVC/);
});

test('active guided-practice behavior is preferred over blank support level', () => {
  const approaches = buildTeachingApproaches({
    behaviors: [{
      id: '1',
      status: 'APPROVED',
      strategyCode: 'GUIDED_PRACTICE',
      instruction: 'Cho bài tập có khung gợi ý về Filter.',
    }],
  });
  assert.equal(approaches.length, 1);
  assert.equal(approaches[0].title, 'Luyện tập có hướng dẫn');
});

test('support level plain labels hide internal enums', () => {
  assert.equal(supportLevelPlainLabel('HIGH_SUPPORT'), 'Hỗ trợ nhiều');
  assert.equal(supportLevelPlainLabel('CHALLENGE'), 'Thử thách');
  assert.equal(supportLevelPlainLabel('STANDARD'), 'Bình thường');
});

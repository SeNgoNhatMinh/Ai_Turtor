import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLearningActionPlan } from '../src/features/student/learning/buildLearningActionPlan.js';

test('builds an ordered action plan from real weak topics and suggestions', () => {
  const plan = buildLearningActionPlan({
    learnedTopics: ['Encapsulation'],
    weakTopics: ['Inheritance'],
    suggestions: [
      { title: 'Polymorphism', priority: 'high' },
      { title: 'Interfaces', priority: 'pinned' },
    ],
  });

  assert.deepEqual(plan.focusItems.map((item) => item.title), [
    'Interfaces',
    'Inheritance',
    'Polymorphism',
  ]);
  assert.deepEqual(plan.masteredTopics, ['Encapsulation']);
  assert.deepEqual(plan.counts, { focus: 3, weak: 1, mastered: 1 });
});

test('does not recommend a mastered topic unless it is also a current weak topic', () => {
  const plan = buildLearningActionPlan({
    learnedTopics: ['JPA Mapping', 'Transactions'],
    weakTopics: ['jpa mapping'],
    suggestions: [{ title: 'Transactions' }, { title: 'JPA Mapping', content: 'Review entity relationships.' }],
  });

  assert.equal(plan.focusItems.length, 1);
  assert.equal(plan.focusItems[0].title.toLowerCase(), 'jpa mapping');
  assert.equal(plan.focusItems[0].status, 'weak');
  assert.equal(plan.focusItems[0].description, 'Review entity relationships.');
  assert.deepEqual(plan.masteredTopics, ['Transactions']);
});

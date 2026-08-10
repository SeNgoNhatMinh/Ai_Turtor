import assert from 'node:assert/strict';
import test from 'node:test';
import {
  backendStillContainsSuggestion,
  filterDeletedSuggestions,
  getSuggestionDeleteContext,
  normalizeAnalyzedSuggestions,
} from '../src/features/student/learning/studentSuggestionState.js';

test('marks generated rule suggestions as non-deletable local analysis', () => {
  const [suggestion] = normalizeAnalyzedSuggestions({
    ruleSuggestions: [{ title: 'Ôn JSP', reason: 'Cần luyện tập', source: 'RULE' }],
  });

  assert.equal(suggestion.persistence, 'LOCAL_ANALYSIS');
  assert.equal(suggestion.deletable, false);
});

test('uses the exact backend value when deleting a normalized memory suggestion', () => {
  const context = getSuggestionDeleteContext({
    title: 'Ôn JSP',
    deleteValue: '{"suggestions":[{"title":"Ôn JSP"}]}',
    persistence: 'BACKEND_MEMORY',
  });

  assert.equal(context.shouldDeleteFromBackend, true);
  assert.equal(context.deleteValue, '{"suggestions":[{"title":"Ôn JSP"}]}');
});

test('removes every cached card that belongs to one backend envelope', () => {
  const target = { title: 'Ôn JSP', deleteValue: 'stored-envelope' };
  const result = filterDeletedSuggestions([
    { title: 'Ôn JSP', deleteValue: 'stored-envelope' },
    { title: 'Làm quiz', deleteValue: 'stored-envelope' },
    { title: 'Servlet', deleteValue: 'another-envelope' },
  ], target);

  assert.deepEqual(result.map((item) => item.title), ['Servlet']);
});

test('detects when backend response still contains the requested value', () => {
  assert.equal(backendStillContainsSuggestion({ improveSuggestions: ['ABC'] }, 'abc'), true);
  assert.equal(backendStillContainsSuggestion({ improveSuggestions: [] }, 'abc'), false);
});

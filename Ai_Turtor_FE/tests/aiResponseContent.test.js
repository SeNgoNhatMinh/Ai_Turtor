import test from 'node:test';
import assert from 'node:assert/strict';
import { getAiMarkdownContent } from '../src/utils/aiResponseContent.js';

test('resolves known AI response text fields without serializing arbitrary JSON', () => {
  assert.equal(getAiMarkdownContent({ answer: 'Answer', content: 'Content' }), 'Answer');
  assert.equal(getAiMarkdownContent({ content: '## Markdown', message: 'Done' }), '## Markdown');
  assert.equal(getAiMarkdownContent({ message: 'Fallback message' }), 'Fallback message');
  assert.equal(getAiMarkdownContent({ content: { unsafe: 'object' } }), '');
  assert.equal(getAiMarkdownContent(['not', 'markdown']), '');
});

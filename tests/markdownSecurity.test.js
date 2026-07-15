import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeImageUrl, sanitizeLinkUrl } from '../src/utils/markdownSecurity.js';

test('allows safe markdown destinations', () => {
  assert.equal(sanitizeLinkUrl('https://example.com/docs'), 'https://example.com/docs');
  assert.equal(sanitizeLinkUrl('mailto:mentor@example.com'), 'mailto:mentor@example.com');
  assert.equal(sanitizeLinkUrl('#constructor'), '#constructor');
  assert.equal(sanitizeImageUrl('/materials/diagram.png'), '/materials/diagram.png');
});

test('blocks unsafe markdown destinations', () => {
  assert.equal(sanitizeLinkUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeLinkUrl('data:text/html,test'), '');
  assert.equal(sanitizeImageUrl('data:image/svg+xml,<svg/>'), '');
  assert.equal(sanitizeImageUrl('file:///tmp/private.png'), '');
});

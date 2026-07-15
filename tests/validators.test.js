import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITS,
  normalizeReviewMode,
  validateAuthForm,
  validateChatInput,
  validateEmail,
  validateUploadFile,
} from '../src/utils/validators.js';

test('normalizes and validates email addresses', () => {
  assert.deepEqual(validateEmail('  Student@School.Local  '), {
    ok: true,
    value: 'student@school.local',
  });
  assert.equal(validateEmail('student').ok, false);
});

test('validates login and registration fields', () => {
  assert.equal(validateAuthForm({
    email: 'student@school.local',
    password: 'secret1',
    isLoginView: true,
  }).ok, true);
  assert.equal(validateAuthForm({
    email: 'student@school.local',
    password: 'secret1',
    fullName: 'A',
    isLoginView: false,
  }).ok, false);
});

test('blocks empty and oversized chat submissions', () => {
  assert.equal(validateChatInput('   ').ok, false);
  assert.deepEqual(validateChatInput('  Explain OOP  '), {
    ok: true,
    value: 'Explain OOP',
  });
  assert.equal(validateChatInput('x'.repeat(LIMITS.chatMax + 1)).ok, false);
});

test('maps review modes to backend enums', () => {
  assert.equal(normalizeReviewMode('CODE_MENTOR'), 'CODE');
  assert.equal(normalizeReviewMode('ESCALATE'), 'ESCALATE');
  assert.equal(normalizeReviewMode('UNKNOWN'), 'RAG');
});

test('validates upload size and MIME type', () => {
  assert.equal(validateUploadFile(null).ok, false);
  assert.equal(validateUploadFile({
    size: 1024,
    type: 'application/pdf',
  }, ['application/pdf']).ok, true);
  assert.equal(validateUploadFile({
    size: LIMITS.uploadMaxBytes + 1,
    type: 'application/pdf',
  }).ok, false);
  assert.equal(validateUploadFile({
    size: 1024,
    type: 'text/plain',
  }, ['application/pdf']).ok, false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITS,
  normalizeReviewMode,
  validateAuthForm,
  validateChatInput,
  validateCodeInput,
  validateOptionalCodeInput,
  validateCodeMentorRequest,
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
  assert.equal(LIMITS.chatMax, 4000);
  assert.equal(validateChatInput('   ').ok, false);
  assert.deepEqual(validateChatInput('  Explain OOP  '), {
    ok: true,
    value: 'Explain OOP',
  });
  assert.equal(validateChatInput('x'.repeat(LIMITS.chatMax + 1)).ok, false);
});

test('keeps Code Mentor limits separate from normal chat limits', () => {
  assert.equal(validateChatInput('x'.repeat(4001)).ok, false);
  assert.equal(validateCodeInput('x'.repeat(12000)).ok, true);
  assert.match(validateCodeInput('x'.repeat(12001)).message, /12000/);
  assert.match(validateCodeInput(Array.from({ length: 101 }, () => 'x').join('\n')).message, /100 dòng/);
  assert.equal(validateCodeMentorRequest({
    question: 'Review this code',
    codeSnippet: 'const ok = true;',
  }).ok, true);
  assert.equal(validateCodeMentorRequest({ question: 'Review', codeSnippet: '' }).ok, false);
  assert.equal(validateOptionalCodeInput('').ok, true);
  assert.equal(validateOptionalCodeInput('   ').ok, true);
  assert.equal(validateOptionalCodeInput('x'.repeat(12001)).ok, false);
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

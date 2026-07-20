import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSIGNMENT_MAX_FILE_BYTES,
  getFileExtension,
  validateAnswerKeyFile,
  validateAssignmentFile,
} from '../src/utils/assignmentFiles.js';

test('accepts backend-supported assignment extensions case-insensitively', () => {
  assert.equal(getFileExtension('Final.Exam.DOCX'), 'docx');
  assert.equal(validateAssignmentFile({ name: 'source.java', size: 1024 }).ok, true);
  assert.equal(validateAssignmentFile({ name: 'bundle.zip', size: 1024 }).ok, true);
});

test('rejects unsupported and oversized assignment files', () => {
  assert.equal(validateAssignmentFile({ name: 'payload.exe', size: 1024 }).ok, false);
  assert.equal(validateAssignmentFile({ name: 'exam.pdf', size: ASSIGNMENT_MAX_FILE_BYTES + 1 }).ok, false);
});

test('keeps private answer keys limited to DOCX, PDF and TXT', () => {
  assert.equal(validateAnswerKeyFile({ name: 'answer-key.pdf', size: 1024 }).ok, true);
  assert.equal(validateAnswerKeyFile({ name: 'answer-key.zip', size: 1024 }).ok, false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { findMentorRequestForMessage } from '../src/features/student/chat/chatMessageUtils.js';

test('finds an existing mentor request for the same chat question and academic scope', () => {
  const request = findMentorRequestForMessage({
    requests: [{
      id: 'escalation-1',
      originalQuestion: 'Servlet là gì?',
      conversationId: 'conversation-1',
      courseId: 'PRJ301',
      classId: '1832',
    }],
    message: { question: '  Servlet là gì? ' },
    conversationId: 'conversation-1',
    courseId: 'prj301',
    classId: 'SE1832',
  });

  assert.equal(request?.id, 'escalation-1');
});

test('does not reuse a mentor request from another conversation', () => {
  const request = findMentorRequestForMessage({
    requests: [{
      id: 'escalation-1',
      originalQuestion: 'Servlet là gì?',
      conversationId: 'conversation-1',
      courseId: 'PRJ301',
      classId: 'SE1832',
    }],
    message: { question: 'Servlet là gì?' },
    conversationId: 'conversation-2',
    courseId: 'PRJ301',
    classId: 'SE1832',
  });

  assert.equal(request, null);
});

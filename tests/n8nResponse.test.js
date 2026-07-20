import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureHarnessSuccess,
  normalizeHarnessChatResponse,
  normalizeHarnessMode,
} from '../src/features/ai-harness/n8nResponse.js';
import { createHarnessEnvelope } from '../src/features/ai-harness/trace.js';

test('normalizes harness modes used by the frontend', () => {
  assert.equal(normalizeHarnessMode('RAG_TUTOR'), 'RAG');
  assert.equal(normalizeHarnessMode('course_ai'), 'RAG');
  assert.equal(normalizeHarnessMode('CODE_MENTOR'), 'CODE');
  assert.equal(normalizeHarnessMode('ESCALATE'), 'ESCALATE');
  assert.equal(normalizeHarnessMode(), 'RAG');
});

test('normalizes wrapped RAG response and removes duplicate sources and suggestions', () => {
  const result = normalizeHarnessChatResponse([{
    success: true,
    data: {
      message: 'A course answer',
      mode: 'RAG_TUTOR',
      confidence: '0.82',
      sessionId: 'conversation-2',
      studentMessageId: 'user-message-1',
      aiMessageId: 'assistant-message-1',
      sources: [
        { materialId: 'material-1', title: 'Java.pdf' },
        { materialId: 'material-1', title: 'Duplicate Java.pdf' },
      ],
      suggestions: ['Review constructors', 'Review constructors'],
    },
  }]);

  assert.equal(result.answer, 'A course answer');
  assert.equal(result.mode, 'RAG');
  assert.equal(result.confidence, 0.82);
  assert.equal(result.conversationId, 'conversation-2');
  assert.equal(result.userMessageId, 'user-message-1');
  assert.equal(result.assistantMessageId, 'assistant-message-1');
  assert.equal(result.sources.length, 1);
  assert.deepEqual(result.nextImproveSuggestions, ['Review constructors']);
});

test('normalizes escalation response and keeps fallback conversation', () => {
  const result = normalizeHarnessChatResponse({
    answer: 'A mentor should review this question.',
    mode: 'ESCALATE',
    escalationId: 'ticket-1',
  }, { conversationId: 'conversation-1' });

  assert.equal(result.mode, 'ESCALATE');
  assert.equal(result.escalated, true);
  assert.equal(result.confidence, 0);
  assert.equal(result.questionEscalationId, 'ticket-1');
  assert.equal(result.conversationId, 'conversation-1');
});

test('rejects malformed or failed harness envelopes', () => {
  assert.throws(
    () => normalizeHarnessChatResponse(null),
    (error) => error.name === 'N8nError' && error.code === 'N8N_CHAT_INVALID_RESPONSE',
  );
  assert.throws(
    () => normalizeHarnessChatResponse({ success: false, error: 'Node failed' }),
    (error) => (
      error.name === 'N8nError'
      && error.code === 'N8N_CHAT_FLOW_FAILED'
      && error.rawMessage === 'Node failed'
    ),
  );
});

test('validates non-chat harness responses', () => {
  assert.deepEqual(ensureHarnessSuccess({ data: { success: true, id: 'review-1' } }), {
    data: { success: true, id: 'review-1' },
    success: true,
    id: 'review-1',
  });
  assert.throws(
    () => ensureHarnessSuccess({ status: 'FAILED', message: 'Rejected' }, 'Review failed.'),
    (error) => error.code === 'N8N_FLOW_FAILED' && error.userMessage === 'Review failed.',
  );
});

test('accepts every successful education workflow status from the backend handoff', () => {
  const successfulStatuses = [
    'SUBMITTED',
    'NEEDS_MENTOR_REVIEW',
    'NEEDS_SENIOR_REVIEW',
    'RESOLVED',
    'GENERATED',
    'DRAFT_CREATED',
    'SUBMITTED_WAITING_TEACHER_REVIEW',
  ];

  successfulStatuses.forEach((status) => {
    assert.equal(ensureHarnessSuccess({ success: true, status }).status, status);
  });
  assert.equal(ensureHarnessSuccess({ success: true, decision: 'APPROVE' }).decision, 'APPROVE');
  assert.equal(ensureHarnessSuccess({ success: true, decision: 'REJECT' }).decision, 'REJECT');
  assert.equal(
    ensureHarnessSuccess({ success: true, knowledgeCandidateCreated: false }).knowledgeCandidateCreated,
    false,
  );
});

test('rejects workflow-level failures even when the HTTP request itself succeeded', () => {
  for (const response of [
    { success: false, status: 'FAILED', error: 'QUIZ_GENERATE_FAILED' },
    { ok: false, status: 'SENIOR_RESOLVE_FAILED', error: 'Cannot resolve review' },
  ]) {
    assert.throws(
      () => ensureHarnessSuccess(response, 'Workflow failed.'),
      (error) => error.code === 'N8N_FLOW_FAILED' && error.userMessage === 'Workflow failed.',
    );
  }
});

test('preserves Vietnamese and exact quiz option text from n8n responses', () => {
  const answer = 'Giải thích tính đóng gói và kế thừa trong OOP.';
  const result = normalizeHarnessChatResponse({
    success: true,
    mode: 'RAG_TUTOR',
    answer,
    sources: [{ title: 'Lập trình hướng đối tượng.pdf' }],
  });

  assert.equal(result.answer, answer);
  assert.equal(result.sources[0].title, 'Lập trình hướng đối tượng.pdf');
});

test('adds trace, session, and authentication context to every harness request', () => {
  const envelope = createHarnessEnvelope({
    studentId: 'student-1',
    courseId: 'PRO192',
    classId: 'SE1833',
    message: 'Constructor là gì?',
  }, 'jwt-token');

  assert.equal(envelope.studentId, 'student-1');
  assert.equal(envelope.courseId, 'PRO192');
  assert.equal(envelope.classId, 'SE1833');
  assert.equal(envelope.message, 'Constructor là gì?');
  assert.equal(envelope.authToken, 'jwt-token');
  assert.ok(envelope.traceId);
  assert.ok(envelope.sessionId);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureHarnessSuccess,
  normalizeHarnessChatResponse,
  normalizeHarnessMode,
} from '../src/features/ai-harness/n8nResponse.js';

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

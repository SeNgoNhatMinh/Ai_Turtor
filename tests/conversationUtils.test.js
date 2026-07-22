import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_TURN_LIMIT,
  getSessionQuestionCount,
  groupSessionsByTime,
  resolveCanonicalConversation,
  sortSessionsByActivity,
} from '../src/features/student/chat/conversations/sessionUtils.js';
import { normalizeSession, pairMessages } from '../src/services/normalizers.js';

test('normalizes conversation limits from backend fields', () => {
  const session = normalizeSession({
    conversationId: 'conversation-1',
    messageCount: 20,
    userQuestionCount: 10,
  });

  assert.equal(session.id, 'conversation-1');
  assert.equal(session.userQuestionCount, CHAT_TURN_LIMIT);
  assert.equal(session.maxTurnsReached, true);
  assert.equal(getSessionQuestionCount(session), CHAT_TURN_LIMIT);
});

test('repairs mojibake conversation titles returned by the backend', () => {
  const session = normalizeSession({
    conversationId: 'conversation-encoding',
    title: 'Cuá»™c trÃ² chuyá»‡n má»›i',
  });

  assert.equal(session.title, 'Cuộc trò chuyện mới');
});

test('falls back from message count and caps the UI counter at ten', () => {
  assert.equal(getSessionQuestionCount({ messageCount: 8 }), 4);
  assert.equal(getSessionQuestionCount({ messageCount: 50 }), CHAT_TURN_LIMIT);
});

test('sorts conversations by last activity and groups them', () => {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const sessions = [
    { id: 'old', lastMessageAt: yesterday.toISOString() },
    { id: 'new', lastMessageAt: now.toISOString() },
  ];

  assert.deepEqual(sortSessionsByActivity(sessions).map((item) => item.id), ['new', 'old']);
  assert.deepEqual(groupSessionsByTime(sessions).map((group) => group.label), ['Hôm nay', 'Hôm qua']);
});

test('reconciles a temporary n8n conversation id with the canonical REST session', () => {
  const previous = [
    { id: 'existing-session', lastMessageAt: '2026-07-22T10:00:00Z', messageCount: 2 },
  ];
  const canonical = {
    id: '392152c5-ce32-4746-86e9-7a16ea6d21cc',
    lastMessageAt: '2026-07-22T10:05:00Z',
    messageCount: 2,
  };

  assert.equal(resolveCanonicalConversation({
    responseConversationId: 'conversation-1784735431773',
    previousSessionId: null,
    sessionsBefore: previous,
    sessionsAfter: [canonical, ...previous],
  })?.id, canonical.id);
});

test('keeps the existing canonical session when n8n responds with that id', () => {
  const session = {
    id: 'canonical-session',
    lastMessageAt: '2026-07-22T10:05:00Z',
    messageCount: 4,
  };

  assert.equal(resolveCanonicalConversation({
    responseConversationId: session.id,
    previousSessionId: session.id,
    sessionsBefore: [{ ...session, messageCount: 2 }],
    sessionsAfter: [session],
  })?.id, session.id);
});

test('pairs canonical student and assistant messages', () => {
  const pairs = pairMessages([
    { id: 'user-1', role: 'STUDENT', content: 'What is OOP?' },
    {
      id: 'ai-1',
      role: 'ASSISTANT',
      content: 'OOP is object-oriented programming.',
      mode: 'RAG',
      suggestions: ['Review classes'],
    },
  ]);

  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].userMessageId, 'user-1');
  assert.equal(pairs[0].assistantMessageId, 'ai-1');
  assert.equal(pairs[0].question, 'What is OOP?');
  assert.equal(pairs[0].answer, 'OOP is object-oriented programming.');
  assert.deepEqual(pairs[0].nextImproveSuggestions, ['Review classes']);
});

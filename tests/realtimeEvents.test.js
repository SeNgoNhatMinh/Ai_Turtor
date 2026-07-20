import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRealtimeSocketUrl,
  eventMatchesCourse,
  getRealtimeEventDedupeKey,
  normalizeRealtimeEvent,
  REALTIME_EVENT_TYPES,
} from '../src/features/realtime/realtimeEvents.js';

test('builds the authenticated websocket URL from an API base URL', () => {
  const url = buildRealtimeSocketUrl({
    apiBaseUrl: 'http://localhost:8085/api',
    token: 'jwt token',
    origin: 'http://localhost:5173',
  });
  assert.equal(url, 'ws://localhost:8085/ws/events?token=jwt+token');
});

test('normalizes realtime envelopes and rejects malformed messages', () => {
  const event = normalizeRealtimeEvent(JSON.stringify({
    type: 'assignment_submitted',
    entityId: 'submission-1',
    data: { courseId: 'PRO192' },
  }));
  assert.equal(event.type, 'ASSIGNMENT_SUBMITTED');
  assert.equal(event.entityId, 'submission-1');
  assert.equal(normalizeRealtimeEvent('not-json'), null);
});

test('filters scoped events without dropping envelopes that omit course data', () => {
  assert.equal(eventMatchesCourse({ data: { courseId: 'PRO192' } }, 'PRO192'), true);
  assert.equal(eventMatchesCourse({ data: { courseId: 'OSG202' } }, 'PRO192'), false);
  assert.equal(eventMatchesCourse({ data: {} }, 'PRO192'), true);
});

test('covers Tutor V2 event names and creates an idempotency key', () => {
  assert.equal(REALTIME_EVENT_TYPES.tutorV2.includes('GOLD_QA_SUBMITTED'), true);
  assert.equal(REALTIME_EVENT_TYPES.tutorV2.includes('EVAL_RUN_COMPLETED'), true);
  assert.equal(getRealtimeEventDedupeKey({
    type: 'GOLD_QA_SUBMITTED',
    entityType: 'GOLD_QA',
    entityId: 'gold-1',
    status: 'PENDING_REVIEW',
  }), 'GOLD_QA_SUBMITTED|GOLD_QA|gold-1|PENDING_REVIEW');
  assert.equal(getRealtimeEventDedupeKey({ type: 'CONNECTED' }), '');
});

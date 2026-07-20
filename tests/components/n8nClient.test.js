import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/env', () => ({
  env: {
    n8nBaseUrl: 'http://localhost:5678',
    n8nWebhookMode: 'production',
    n8nEnabled: true,
    n8nStrict: true,
    n8nTimeoutMs: 60_000,
    n8nChatTimeoutMs: 180_000,
    n8nQuizTimeoutMs: 240_000,
    n8nQuizEnabled: true,
    n8nAssignmentGradingEnabled: true,
    n8nAssignmentGradingTimeoutMs: 300_000,
    n8nTutorV2Enabled: true,
    n8nTutorV2TimeoutMs: 300_000,
  },
}));

vi.mock('../../src/features/auth/services/tokenStorage', () => ({
  getAuthToken: () => 'student-jwt',
}));

import { postN8n } from '../../src/services/n8nClient';

describe('n8n HTTP client education contract', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    window.sessionStorage.clear();
  });

  it('sends UTF-8 JSON with header-only JWT, trace context, and unchanged Vietnamese text', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      mode: 'RAG_TUTOR',
      answer: 'Đây là câu trả lời có dấu.',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await postN8n('/student-chat', {
      studentId: 'student-1',
      courseId: 'PRO192',
      classId: 'SE1833',
      message: 'Giải thích tính kế thừa.',
    });

    const [url, request] = fetch.mock.calls[0];
    const body = JSON.parse(request.body);
    expect(url).toBe('http://localhost:5678/webhook/student-chat');
    expect(request.headers['Content-Type']).toBe('application/json; charset=utf-8');
    expect(request.headers.Authorization).toBe('Bearer student-jwt');
    expect(body.authToken).toBeUndefined();
    expect(body.message).toBe('Giải thích tính kế thừa.');
    expect(body.traceId).toBeTruthy();
    expect(body.sessionId).toBeTruthy();
  });

  it('rejects malformed successful responses instead of treating HTTP 200 as business success', async () => {
    fetch.mockResolvedValue(new Response('<html>workflow error</html>', { status: 200 }));

    await expect(postN8n('/answer-review', {})).rejects.toMatchObject({
      name: 'N8nError',
      details: expect.objectContaining({ code: 'N8N_MALFORMED_JSON' }),
    });
  });

  it('keeps Tutor V2 JWT in the Authorization header instead of the request body', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({ gaps: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await postN8n('/v2-coverage-analyze', { courseId: 'PRO192' }, {
      includeAuthTokenInBody: false,
    });

    const [, request] = fetch.mock.calls[0];
    const body = JSON.parse(request.body);
    expect(request.headers.Authorization).toBe('Bearer student-jwt');
    expect(body.authToken).toBeUndefined();
    expect(body.courseId).toBe('PRO192');
    expect(body.traceId).toBeTruthy();
  });

  it('only includes a body token when an explicit legacy compatibility call requests it', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await postN8n('/legacy-only', { courseId: 'PRO192' }, {
      includeAuthTokenInBody: true,
    });

    const [, request] = fetch.mock.calls[0];
    expect(JSON.parse(request.body).authToken).toBe('student-jwt');
    expect(request.headers.Authorization).toBe('Bearer student-jwt');
  });
});

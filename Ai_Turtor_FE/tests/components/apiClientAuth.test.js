import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blobRequest, request } from '../../src/services/apiClient';

describe('apiClient bearer authentication', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('adds the current JWT directly to protected requests', async () => {
    window.localStorage.setItem('ai_tutor_jwt', 'current-admin-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ providers: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    await request('/api/admin/llm-providers', { skipUnauthorizedRedirect: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer current-admin-token');
  });

  it('does not invent an Authorization header before login', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ status: 'UP' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    await request('/actuator/health');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('preserves the current session when a background request opts out of redirecting', async () => {
    window.localStorage.setItem('ai_tutor_jwt', 'current-student-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    ));

    await expect(request('/api/students/student-1/assignments', {
      skipUnauthorizedRedirect: true,
      retries: 0,
    })).rejects.toMatchObject({ status: 401 });

    expect(window.localStorage.getItem('ai_tutor_jwt')).toBe('current-student-token');
  });

  it('keeps a specific login failure message on a 401 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ error: 'Email hoặc Password không chính xác' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    ));

    await expect(request('/api/users/login', {
      method: 'POST',
      body: { email: 'student@example.com', password: 'wrong' },
      skipUnauthorizedRedirect: true,
    })).rejects.toMatchObject({
      status: 401,
      userMessage: 'Email hoặc Password không chính xác',
    });
  });

  it('parses a JSON TTS error even when the caller expects an audio blob', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({
        code: 'TTS_UNAVAILABLE',
        message: 'Không thể tạo giọng đọc lúc này.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    ));

    await expect(blobRequest('/api/tts/synthesize', {
      method: 'POST',
      body: { messageId: 'm1', courseId: 'PRJ301', classId: 'SE1832', text: 'Xin chào' },
    })).rejects.toMatchObject({
      code: 'TTS_UNAVAILABLE',
      userMessage: 'Không thể tạo giọng đọc lúc này.',
    });
  });
});

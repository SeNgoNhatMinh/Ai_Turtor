import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../../src/services/apiClient';

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
});

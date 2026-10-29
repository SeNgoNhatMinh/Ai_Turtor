import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshAccessToken, revokeRefreshSession } from '../../src/features/auth/services/tokenRefresh';

describe('refresh token session', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete window.navigator.locks;
  });

  it('stores only the refreshed access token in JavaScript storage', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          userId: 'student-1',
          email: 'student@example.com',
          fullName: 'Student One',
          role: 'STUDENT',
          token: 'new-access-token',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await refreshAccessToken();

    expect(window.localStorage.getItem('ai_tutor_jwt')).toBe('new-access-token');
    expect(window.localStorage.getItem('ai_tutor_refresh')).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toContain('/users/refresh');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  it('revokes the cookie session and clears the local access token on logout', async () => {
    window.localStorage.setItem('ai_tutor_jwt', 'old-access-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    await revokeRefreshSession();

    expect(window.localStorage.getItem('ai_tutor_jwt')).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toContain('/users/logout');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  it('reuses the token refreshed by another tab after acquiring the browser lock', async () => {
    window.localStorage.setItem('ai_tutor_jwt', 'expired-access-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    Object.defineProperty(window.navigator, 'locks', {
      configurable: true,
      value: {
        request: vi.fn(async (_name, _options, callback) => {
          window.localStorage.setItem('ai_tutor_jwt', 'other-tab-access-token');
          return callback();
        }),
      },
    });

    const refreshed = await refreshAccessToken();

    expect(refreshed.token).toBe('other-tab-access-token');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

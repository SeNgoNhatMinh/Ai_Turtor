import { httpRequest } from '../../../services/httpClient';
import { normalizeLoginResponse, getJwtExpiresAtMs, isJwtExpired } from './authResponse';
import { clearAuthToken, getAuthToken, setAuthToken } from './tokenStorage';

let refreshPromise = null;
const REFRESH_LOCK_NAME = 'ai-tutor-refresh-token';

async function requestRefreshedSession(previousToken) {
  const currentToken = getAuthToken();
  if (currentToken && currentToken !== previousToken && !isJwtExpired(currentToken)) {
    return { token: currentToken, user: null };
  }

  const response = await httpRequest('/users/refresh', {
    method: 'POST',
    credentials: 'include',
    retries: 0,
  });
  const normalized = normalizeLoginResponse(response);
  setAuthToken(normalized.token);
  return normalized;
}

export function refreshAccessToken() {
  if (!refreshPromise) {
    const previousToken = getAuthToken();
    const refresh = () => requestRefreshedSession(previousToken);
    const locks = globalThis.navigator?.locks;
    refreshPromise = (locks ? locks.request(REFRESH_LOCK_NAME, { mode: 'exclusive' }, refresh) : refresh()).finally(
      () => {
        refreshPromise = null;
      },
    );
  }
  return refreshPromise;
}

export async function ensureFreshAccessToken(bufferMs = 60_000) {
  const token = getAuthToken();
  const expiresAt = getJwtExpiresAtMs(token);
  if (expiresAt && expiresAt <= Date.now() + bufferMs) {
    const refreshed = await refreshAccessToken();
    return refreshed.token;
  }
  return token;
}

export async function revokeRefreshSession() {
  try {
    await httpRequest('/users/logout', {
      method: 'POST',
      credentials: 'include',
      retries: 0,
    });
  } finally {
    clearAuthToken();
  }
}

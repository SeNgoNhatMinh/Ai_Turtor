import { env } from '../config/env';
import { getUserFacingError, httpClient, httpRequest, ApiError } from './httpClient';
import { clearAuthToken, getAuthToken } from '../features/auth/services/tokenStorage';
import { refreshAccessToken } from '../features/auth/services/tokenRefresh';
import { APP_SESSION_USER_KEY, clearLastPath, removeJsonStorage } from '../utils/storage';

export const API_BASE_URL = env.apiBaseUrl;
export const API_TIMEOUTS = {
  default: env.apiTimeoutMs,
  ai: 180000,
  quizGeneration: 240000,
  upload: 180000,
  download: 300000,
  websiteImport: 900000,
  reindex: 900000,
};

function withAuthHeaders(headers = {}) {
  const token = getAuthToken();
  if (!token || headers.Authorization || headers.authorization) return headers;
  return { ...headers, Authorization: `Bearer ${token}` };
}

function stripBaseUrl(url) {
  const value = String(url || '');
  if (value.startsWith(API_BASE_URL)) {
    return value.slice(API_BASE_URL.length) || '/';
  }
  try {
    const apiPath = new URL(API_BASE_URL, window.location.origin).pathname.replace(/\/$/, '');
    if (apiPath && apiPath !== '/' && (value === apiPath || value.startsWith(`${apiPath}/`))) {
      return value.slice(apiPath.length) || '/';
    }
  } catch {
    // Keep the original relative URL when the configured base cannot be parsed.
  }
  return value;
}

let unauthorizedRedirectStarted = false;

function handleUnauthorized(error) {
  if (!(error instanceof ApiError) || error.status !== 401 || unauthorizedRedirectStarted) return;
  unauthorizedRedirectStarted = true;
  clearAuthToken();
  if (typeof window !== 'undefined') {
    removeJsonStorage(APP_SESSION_USER_KEY);
    clearLastPath();
    window.location.reload();
  }
}

async function runWithAuthRecovery(operation, { skipUnauthorizedRedirect = false, skipAuthRefresh = false } = {}) {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || skipAuthRefresh) {
      if (!skipUnauthorizedRedirect) handleUnauthorized(error);
      throw error;
    }

    try {
      await refreshAccessToken();
    } catch {
      if (!skipUnauthorizedRedirect) handleUnauthorized(error);
      throw error;
    }

    try {
      return await operation();
    } catch (retryError) {
      if (!skipUnauthorizedRedirect) handleUnauthorized(retryError);
      throw retryError;
    }
  }
}

export async function request(url, options = {}) {
  const {
    headers,
    body,
    method = 'GET',
    signal,
    responseType,
    skipUnauthorizedRedirect = false,
    skipAuthRefresh = false,
    ...restOptions
  } = options;
  let parsedBody = body;
  if (typeof body === 'string' && headers?.['Content-Type']?.includes('application/json')) {
    try {
      parsedBody = JSON.parse(body);
    } catch {
      parsedBody = body;
    }
  }

  return runWithAuthRecovery(
    () =>
      httpRequest(stripBaseUrl(url), {
        method,
        headers: withAuthHeaders(headers),
        body: parsedBody,
        signal,
        responseType,
        ...restOptions,
      }),
    { skipUnauthorizedRedirect, skipAuthRefresh },
  );
}

export async function uploadRequest(url, formData, errorPrefix = 'Upload failed', options = {}) {
  const { skipUnauthorizedRedirect = false, skipAuthRefresh = false, ...uploadOptions } = options;
  try {
    return await runWithAuthRecovery(
      () =>
        httpClient.upload(stripBaseUrl(url), formData, {
          ...uploadOptions,
          headers: withAuthHeaders(uploadOptions.headers),
        }),
      { skipUnauthorizedRedirect, skipAuthRefresh },
    );
  } catch (error) {
    error.message = error.message || errorPrefix;
    throw error;
  }
}

export async function blobRequest(url, options = {}) {
  const { skipUnauthorizedRedirect = false, skipAuthRefresh = false, ...requestOptions } = options;
  return runWithAuthRecovery(
    () =>
      httpClient.blob(stripBaseUrl(url), {
        ...requestOptions,
        headers: withAuthHeaders(requestOptions.headers),
      }),
    { skipUnauthorizedRedirect, skipAuthRefresh },
  );
}

export { getUserFacingError };

import { env } from '../config/env';
import { getUserFacingError, httpClient, httpRequest, ApiError } from './httpClient';
import { clearAuthToken, getAuthToken } from '../features/auth/services/tokenStorage';
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

export async function request(url, options = {}) {
  const {
    headers,
    body,
    method = 'GET',
    signal,
    responseType,
    skipUnauthorizedRedirect = false,
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

  try {
    return await httpRequest(stripBaseUrl(url), {
      method,
      headers: withAuthHeaders(headers),
      body: parsedBody,
      signal,
      responseType,
      ...restOptions,
    });
  } catch (error) {
    if (!skipUnauthorizedRedirect) handleUnauthorized(error);
    throw error;
  }
}

export async function uploadRequest(url, formData, errorPrefix = "Upload failed", options = {}) {
  try {
    return await httpClient.upload(stripBaseUrl(url), formData, {
      ...options,
      headers: withAuthHeaders(options.headers),
    });
  } catch (error) {
    handleUnauthorized(error);
    error.message = error.message || errorPrefix;
    throw error;
  }
}

export async function blobRequest(url, options = {}) {
  const { skipUnauthorizedRedirect = false, ...requestOptions } = options;
  try {
    return await httpClient.blob(stripBaseUrl(url), {
      ...requestOptions,
      headers: withAuthHeaders(requestOptions.headers),
    });
  } catch (error) {
    if (!skipUnauthorizedRedirect) handleUnauthorized(error);
    throw error;
  }
}

export { getUserFacingError };

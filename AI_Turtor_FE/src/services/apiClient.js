import { env } from '../config/env';
import { getUserFacingError, httpClient, httpRequest, addRequestInterceptor, ApiError } from './httpClient';
import { clearAuthToken, getAuthToken } from '../features/auth/services/tokenStorage';

export const API_BASE_URL = env.apiBaseUrl;
export const API_TIMEOUTS = {
  default: env.apiTimeoutMs,
  ai: 180000,
  quizGeneration: 240000,
  upload: 180000,
  websiteImport: 900000,
  reindex: 900000,
};

addRequestInterceptor((config) => {
  const token = getAuthToken();
  if (token) {
    config.init.headers = config.init.headers || {};
    config.init.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

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
    window.sessionStorage.removeItem('ai-tutor:current-user');
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
      headers,
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
    return await httpClient.upload(stripBaseUrl(url), formData, options);
  } catch (error) {
    handleUnauthorized(error);
    error.message = error.message || errorPrefix;
    throw error;
  }
}

export async function blobRequest(url, options = {}) {
  const { skipUnauthorizedRedirect = false, ...requestOptions } = options;
  try {
    return await httpClient.blob(stripBaseUrl(url), requestOptions);
  } catch (error) {
    if (!skipUnauthorizedRedirect) handleUnauthorized(error);
    throw error;
  }
}

export { getUserFacingError };

import { env } from '../config/env';
import { getUserFacingError, httpClient, httpRequest, addRequestInterceptor, ApiError } from './httpClient';

export const API_BASE_URL = env.apiBaseUrl;
export const API_TIMEOUTS = {
  default: env.apiTimeoutMs,
  ai: 180000,
  quizGeneration: 240000,
  upload: 180000,
};

addRequestInterceptor((config) => {
  const token = window.localStorage.getItem('ai_tutor_jwt');
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
  return value;
}

export async function request(url, options = {}) {
  const { headers, body, method = 'GET', signal, responseType, ...restOptions } = options;
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
    if (error instanceof ApiError && error.status === 401) {
      window.localStorage.removeItem('ai_tutor_jwt');
      window.sessionStorage.removeItem('ai-tutor:current-user');
      window.location.reload();
    }
    throw error;
  }
}

export async function uploadRequest(url, formData, errorPrefix = "Upload failed", options = {}) {
  try {
    return await httpClient.upload(stripBaseUrl(url), formData, options);
  } catch (error) {
    error.message = error.message || errorPrefix;
    throw error;
  }
}

export async function blobRequest(url) {
  return httpClient.blob(stripBaseUrl(url));
}

export { getUserFacingError };

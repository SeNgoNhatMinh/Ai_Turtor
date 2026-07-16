import { buildUrl, env } from '../config/env';
import { getSafeUserMessage } from '../utils/errorMessages';

export class ApiError extends Error {
  constructor({ message, userMessage, rawMessage, status = 0, code = 'API_ERROR', details = null } = {}) {
    super(userMessage || message || 'Request failed');
    this.name = 'ApiError';
    this.userMessage = userMessage || message || 'Request failed';
    this.rawMessage = rawMessage || message || null;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getUserFacingError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  return getSafeUserMessage(error.userMessage || error.message, fallback);
}

const requestInterceptors = [];

export function addRequestInterceptor(interceptor) {
  requestInterceptors.push(interceptor);
  return () => {
    const index = requestInterceptors.indexOf(interceptor);
    if (index >= 0) requestInterceptors.splice(index, 1);
  };
}

async function parseResponse(response, responseType) {
  if (response.status === 204) return null;
  if (responseType === 'blob') return response.blob();
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  const text = await response.text();
  return text || null;
}

function normalizeError(error, response, body) {
  if (error?.name === 'AbortError') {
    return new ApiError({
      message: 'Request timed out. Please try again.',
      userMessage: 'Request timed out. Please try again.',
      status: 0,
      code: 'TIMEOUT',
      details: error,
    });
  }

  if (!response) {
    return new ApiError({
      message: error?.message || 'Network request failed.',
      userMessage: 'Network request failed. Please check your connection and try again.',
      status: 0,
      code: 'NETWORK_ERROR',
      details: error,
    });
  }

  const message =
    body?.error ||
    body?.message ||
    (typeof body === 'string' && body) ||
    response.statusText ||
    'Request failed';

  const userMessage = (() => {
    if (response.status === 500) {
      return 'The server had trouble processing this request. Please try again later.';
    }
    if ([502, 503, 504].includes(response.status)) {
      return 'The AI Tutor service is temporarily unavailable. Please try again in a moment.';
    }
    return getSafeUserMessage(message, 'The request could not be completed. Please check your input and try again.');
  })();

  return new ApiError({
    message: userMessage,
    rawMessage: message,
    userMessage,
    status: response.status,
    code: body?.code || `HTTP_${response.status}`,
    details: body,
  });
}

export async function httpRequest(path, options = {}) {
  const {
    method = 'GET',
    query,
    body,
    headers = {},
    timeoutMs = env.apiTimeoutMs,
    responseType = 'json',
    signal,
  } = options;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener('abort', abortFromCaller, { once: true });

  let config = {
    url: buildUrl(path, query),
    init: {
      method,
      credentials: env.apiWithCredentials ? 'include' : 'same-origin',
      headers: { ...headers },
      signal: controller.signal,
    },
  };

  if (body !== undefined && body !== null) {
    if (body instanceof FormData) {
      config.init.body = body;
    } else {
      config.init.headers['Content-Type'] = config.init.headers['Content-Type'] || 'application/json';
      config.init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
  }

  for (const interceptor of requestInterceptors) {
    config = (await interceptor(config)) || config;
  }

  let response;
  let parsedBody;
  try {
    response = await fetch(config.url, config.init);
    parsedBody = await parseResponse(response, responseType);

    if (!response.ok) {
      throw normalizeError(null, response, parsedBody);
    }

    return parsedBody;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw normalizeError(error, response, parsedBody);
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

export const httpClient = {
  get: (path, options) => httpRequest(path, { ...options, method: 'GET' }),
  post: (path, body, options) => httpRequest(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => httpRequest(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => httpRequest(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => httpRequest(path, { ...options, method: 'DELETE' }),
  upload: (path, formData, options) => httpRequest(path, { ...options, method: 'POST', body: formData }),
  blob: (path, options) => httpRequest(path, { ...options, responseType: 'blob' }),
};

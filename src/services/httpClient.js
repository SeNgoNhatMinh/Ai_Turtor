import { buildUrl, env } from '../config/env';

export class ApiError extends Error {
  constructor({ message, status = 0, code = 'API_ERROR', details = null } = {}) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const requestInterceptors = [];
const responseInterceptors = [];

export function addRequestInterceptor(interceptor) {
  requestInterceptors.push(interceptor);
  return () => {
    const index = requestInterceptors.indexOf(interceptor);
    if (index >= 0) requestInterceptors.splice(index, 1);
  };
}

export function addResponseInterceptor(interceptor) {
  responseInterceptors.push(interceptor);
  return () => {
    const index = responseInterceptors.indexOf(interceptor);
    if (index >= 0) responseInterceptors.splice(index, 1);
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
      status: 0,
      code: 'TIMEOUT',
      details: error,
    });
  }

  if (!response) {
    return new ApiError({
      message: error?.message || 'Network request failed.',
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

  return new ApiError({
    message,
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
  const mergedSignal = signal || controller.signal;

  let config = {
    url: buildUrl(path, query),
    init: {
      method,
      credentials: env.apiWithCredentials ? 'include' : 'same-origin',
      headers: { ...headers },
      signal: mergedSignal,
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

    let result = parsedBody;
    for (const interceptor of responseInterceptors) {
      result = (await interceptor(result, response)) ?? result;
    }
    return result;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw normalizeError(error, response, parsedBody);
  } finally {
    window.clearTimeout(timeout);
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

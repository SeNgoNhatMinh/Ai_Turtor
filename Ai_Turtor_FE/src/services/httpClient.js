import { buildUrl, env } from '../config/env';
import { getSafeUserMessage } from '../utils/errorMessages';

export class ApiError extends Error {
  constructor({ message, userMessage, rawMessage, status = 0, code = 'API_ERROR', details = null } = {}) {
    super(userMessage || message || 'Yêu cầu thất bại');
    this.name = 'ApiError';
    this.userMessage = userMessage || message || 'Yêu cầu thất bại';
    this.rawMessage = rawMessage || message || null;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getUserFacingError(error, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.') {
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
      message: 'Yêu cầu đã hết thời gian chờ. Vui lòng thử lại.',
      userMessage: 'Yêu cầu đã hết thời gian chờ. Vui lòng thử lại.',
      status: 0,
      code: 'TIMEOUT',
      details: error,
    });
  }

  if (!response) {
    return new ApiError({
      message: error?.message || 'Network request failed.',
      userMessage: 'Không thể kết nối tới máy chủ. Hãy kiểm tra mạng và thử lại.',
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
    if (response.status === 429) {
      if (body?.code === 'DAILY_COURSE_QUESTION_LIMIT_REACHED') {
        return getSafeUserMessage(
          body?.message || body?.error,
          'Bạn đã dùng hết 10 câu hỏi hôm nay cho môn học này. Hạn mức sẽ tự làm mới vào ngày mai.',
        );
      }
      return 'AI Tutor đang nhận quá nhiều yêu cầu. Hệ thống sẽ tự thử mô hình dự phòng khi có thể; vui lòng đợi một chút rồi gửi lại.';
    }
    if (response.status === 500) {
      return 'Máy chủ gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại sau.';
    }
    if ([502, 503, 504].includes(response.status)) {
      return 'Dịch vụ AI Tutor đang tạm thời gián đoạn. Vui lòng thử lại sau ít phút.';
    }
    return getSafeUserMessage(message, 'Không thể hoàn tất yêu cầu. Hãy kiểm tra dữ liệu và thử lại.');
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
    retries = method === 'GET' ? 4 : 0,
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
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      response = undefined;
      parsedBody = undefined;
      try {
        response = await fetch(config.url, config.init);
        parsedBody = await parseResponse(response, responseType);

        if (!response.ok) {
          throw normalizeError(null, response, parsedBody);
        }

        return parsedBody;
      } catch (error) {
        const normalized = error instanceof ApiError ? error : normalizeError(error, response, parsedBody);
        const retryableStatus = !normalized.status || [502, 503, 504].includes(normalized.status);
        const canRetry = method === 'GET'
          && attempt < retries
          && retryableStatus
          && !controller.signal.aborted;
        if (!canRetry) throw normalized;
        const retryDelay = [500, 1500, 3000, 5000][attempt] || 5000;
        await new Promise((resolve) => window.setTimeout(resolve, retryDelay));
      }
    }
    throw normalizeError(null, response, parsedBody);
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

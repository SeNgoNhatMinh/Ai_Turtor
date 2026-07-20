import { env } from '../config/env';
import { getAuthToken } from '../features/auth/services/tokenStorage';
import { createHarnessEnvelope } from '../features/ai-harness/trace';

const N8N_BASE_URL = env.n8nBaseUrl;
const N8N_WEBHOOK_MODE = env.n8nWebhookMode;
export const N8N_ENABLED = env.n8nEnabled;
export const N8N_STRICT = env.n8nStrict;
const N8N_TIMEOUT_MS = env.n8nTimeoutMs;
export const N8N_CHAT_TIMEOUT_MS = env.n8nChatTimeoutMs;
export const N8N_QUIZ_TIMEOUT_MS = env.n8nQuizTimeoutMs;
export const N8N_QUIZ_ENABLED = env.n8nQuizEnabled;
export const N8N_ASSIGNMENT_GRADING_ENABLED = env.n8nAssignmentGradingEnabled;
export const N8N_ASSIGNMENT_GRADING_TIMEOUT_MS = env.n8nAssignmentGradingTimeoutMs;
export const N8N_TUTOR_V2_ENABLED = env.n8nTutorV2Enabled;
export const N8N_TUTOR_V2_TIMEOUT_MS = env.n8nTutorV2TimeoutMs;

function createN8nError(userMessage = 'Luồng AI đang tạm thời gián đoạn.', details = null) {
  const error = new Error(userMessage);
  error.name = 'N8nError';
  error.userMessage = userMessage;
  error.rawMessage = details?.rawMessage || details?.message || null;
  error.details = details;
  return error;
}

function n8nUrl(path) {
  const prefix = N8N_WEBHOOK_MODE === 'test' ? '/webhook-test' : '/webhook';
  return `${N8N_BASE_URL}${prefix}${path}`;
}

export async function postN8n(path, body, {
  signal,
  timeoutMs = N8N_TIMEOUT_MS,
  includeAuthTokenInBody = false,
} = {}) {
  if (!N8N_ENABLED) {
    throw createN8nError('Luồng AI hiện chưa được bật.', { code: 'N8N_DISABLED' });
  }
  const url = n8nUrl(path);
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  const token = getAuthToken();
  const envelope = createHarnessEnvelope(body, includeAuthTokenInBody ? token : '');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(envelope),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw createN8nError(
        timedOut ? 'Luồng AI đang xử lý lâu hơn bình thường.' : 'Yêu cầu tới luồng AI đã bị hủy.',
        {
          code: timedOut ? 'N8N_TIMEOUT' : 'N8N_ABORTED',
          traceId: envelope.traceId,
          cause: error,
        },
      );
    }
    throw createN8nError('Luồng AI đang tạm thời gián đoạn.', {
      code: 'N8N_NETWORK_ERROR',
      traceId: envelope.traceId,
      rawMessage: error?.message,
      cause: error,
    });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }

  const responseText = await res.text().catch(() => '');
  let parsed = null;
  if (responseText) {
    try {
      parsed = JSON.parse(responseText);
    } catch (error) {
      if (res.ok) {
        throw createN8nError('Luồng AI trả về dữ liệu không hợp lệ.', {
          code: 'N8N_MALFORMED_JSON',
          traceId: envelope.traceId,
          rawMessage: responseText,
          cause: error,
        });
      }
    }
  }

  if (!res.ok) {
    const message = parsed?.error || parsed?.message || responseText || res.statusText;
    throw createN8nError('Không thể hoàn tất yêu cầu tới luồng AI.', {
      code: `N8N_HTTP_${res.status}`,
      status: res.status,
      traceId: envelope.traceId,
      rawMessage: message,
      body: parsed || responseText,
    });
  }

  if (!parsed) {
    throw createN8nError('Luồng AI không trả về dữ liệu.', {
      code: 'N8N_EMPTY_RESPONSE',
      traceId: envelope.traceId,
    });
  }

  if (Array.isArray(parsed)) {
    return parsed.map((item, index) => (
      index === 0 && item && typeof item === 'object'
        ? { ...item, traceId: item.traceId || envelope.traceId }
        : item
    ));
  }

  return { ...parsed, traceId: parsed.traceId || envelope.traceId };
}

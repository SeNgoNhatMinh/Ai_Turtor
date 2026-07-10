import { env } from '../config/env';

export const N8N_BASE_URL = env.n8nBaseUrl;
export const N8N_WEBHOOK_MODE = env.n8nWebhookMode;
export const N8N_ENABLED = env.n8nEnabled;
export const N8N_TIMEOUT_MS = env.n8nTimeoutMs;

export function createN8nError(userMessage = 'AI workflow is temporarily unavailable.', details = null) {
  const error = new Error(userMessage);
  error.name = 'N8nError';
  error.userMessage = userMessage;
  error.rawMessage = details?.rawMessage || details?.message || null;
  error.details = details;
  return error;
}

export function n8nUrl(path) {
  const prefix = N8N_WEBHOOK_MODE === 'test' ? '/webhook-test' : '/webhook';
  return `${N8N_BASE_URL}${prefix}${path}`;
}

export async function postN8n(path, body) {
  if (!N8N_ENABLED) {
    throw createN8nError('AI workflow is disabled.', { code: 'N8N_DISABLED' });
  }
  const url = n8nUrl(path);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

  const headers = { 'Content-Type': 'application/json' };
  const token = window.localStorage.getItem('ai_tutor_jwt');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const responseText = await res.text().catch(() => '');
  let parsed = null;
  if (responseText) {
    try {
      parsed = JSON.parse(responseText);
    } catch (error) {
      if (res.ok) {
        throw createN8nError('AI workflow returned an invalid response.', {
          code: 'N8N_MALFORMED_JSON',
          rawMessage: responseText,
          cause: error,
        });
      }
    }
  }

  if (!res.ok) {
    const message = parsed?.error || parsed?.message || responseText || res.statusText;
    throw createN8nError('AI workflow request failed.', {
      code: `N8N_HTTP_${res.status}`,
      status: res.status,
      rawMessage: message,
      body: parsed || responseText,
    });
  }

  if (!parsed) {
    throw createN8nError('AI workflow returned an empty response.', { code: 'N8N_EMPTY_RESPONSE' });
  }

  return parsed;
}

import { env } from '../config/env';

export const N8N_BASE_URL = env.n8nBaseUrl;
export const N8N_WEBHOOK_MODE = env.n8nWebhookMode;
export const N8N_ENABLED = env.n8nEnabled;
export const N8N_TIMEOUT_MS = env.n8nTimeoutMs;

export function n8nUrl(path) {
  const prefix = N8N_WEBHOOK_MODE === 'test' ? '/webhook-test' : '/webhook';
  return `${N8N_BASE_URL}${prefix}${path}`;
}

export async function postN8n(path, body) {
  if (!N8N_ENABLED) {
    throw new Error('n8n is disabled.');
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

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    let message = errorBody || res.statusText;
    try {
      const parsed = JSON.parse(errorBody);
      message = parsed.error || parsed.message || message;
    } catch {
      // Keep fallback
    }
    throw new Error(`n8n request failed: ${message}`);
  }

  return await res.json();
}

export const N8N_BASE_URL = import.meta.env.VITE_N8N_BASE_URL || 'http://localhost:5678';
export const N8N_WEBHOOK_MODE = import.meta.env.VITE_N8N_WEBHOOK_MODE || 'production';
export const N8N_ENABLED = import.meta.env.VITE_N8N_ENABLED === 'true';

export function n8nUrl(path) {
  const prefix = N8N_WEBHOOK_MODE === 'test' ? '/webhook-test' : '/webhook';
  return `${N8N_BASE_URL}${prefix}${path}`;
}

export async function postN8n(path, body) {
  const url = n8nUrl(path);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

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

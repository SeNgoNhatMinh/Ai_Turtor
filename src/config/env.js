const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

export const env = {
  apiBaseUrl: trimTrailingSlash(import.meta.env.VITE_API_BASE_URL || '/api'),
  apiTimeoutMs: parseNumber(import.meta.env.VITE_API_TIMEOUT_MS, 60000),
  apiWithCredentials: parseBoolean(import.meta.env.VITE_API_WITH_CREDENTIALS, false),
  chatSocketUrl: trimTrailingSlash(import.meta.env.VITE_CHAT_SOCKET_URL || ''),
  n8nEnabled: parseBoolean(import.meta.env.VITE_N8N_ENABLED, false),
  n8nStrict: parseBoolean(import.meta.env.VITE_N8N_STRICT, false),
  n8nBaseUrl: trimTrailingSlash(import.meta.env.VITE_N8N_BASE_URL || 'http://localhost:5678'),
  n8nWebhookMode: import.meta.env.VITE_N8N_WEBHOOK_MODE || 'production',
  n8nTimeoutMs: parseNumber(import.meta.env.VITE_N8N_TIMEOUT_MS, 60000),
  n8nChatTimeoutMs: parseNumber(import.meta.env.VITE_N8N_CHAT_TIMEOUT_MS, 180000),
  n8nQuizTimeoutMs: parseNumber(import.meta.env.VITE_N8N_QUIZ_TIMEOUT_MS, 240000),
  n8nQuizEnabled: parseBoolean(import.meta.env.VITE_N8N_QUIZ_ENABLED, false),
};

export function buildUrl(path, query) {
  if (String(path || '').startsWith('http')) return String(path);
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${path}`;
  const params = query instanceof URLSearchParams ? query : new URLSearchParams();
  if (query && !(query instanceof URLSearchParams)) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });
  }
  const qs = params.toString();
  return `${env.apiBaseUrl}${normalizedPath}${qs ? `?${qs}` : ''}`;
}

export const encodePath = (value) => encodeURIComponent(String(value ?? ''));

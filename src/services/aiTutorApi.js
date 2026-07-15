import { API_BASE_URL, API_TIMEOUTS, request } from './apiClient';

export const aiTutorApi = {
  async sendQuery(payload, userId, userName = '', userEmail = '', options = {}) {
    const params = new URLSearchParams({ userId });
    if (userName) params.append('userName', userName);
    if (userEmail) params.append('userEmail', userEmail);
    return request(`${API_BASE_URL}/ai/query?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: API_TIMEOUTS.ai,
      signal: options.signal,
    });
  },

  async reviewCode(payload) {
    return request(`${API_BASE_URL}/code-mentor/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: API_TIMEOUTS.ai,
    });
  },
};

import { API_BASE_URL, request } from './apiClient';

export const adminAiLogsApi = {
  async getLogs(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') params.set(key, String(value));
    });
    const query = params.toString();
    return request(`${API_BASE_URL}/admin/ai-logs${query ? `?${query}` : ''}`, {
      // A logs-only authorization mismatch must not destroy an otherwise valid admin session.
      skipUnauthorizedRedirect: true,
    });
  },
  async getProviderStats() {
    return request(`${API_BASE_URL}/admin/llm-providers/stats`, {
      skipUnauthorizedRedirect: true,
    });
  },
};

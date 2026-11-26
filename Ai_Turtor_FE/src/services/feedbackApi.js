import { API_BASE_URL, request } from './apiClient';

// Experience survey (test period): one answer per account; admins read the summary.
export const feedbackApi = {
  getMine(options = {}) {
    return request(`${API_BASE_URL}/feedback/me`, { signal: options.signal });
  },

  submit(payload) {
    return request(`${API_BASE_URL}/feedback`, { method: 'POST', body: payload });
  },

  getSummary(options = {}) {
    return request(`${API_BASE_URL}/admin/feedback`, { signal: options.signal });
  },
};

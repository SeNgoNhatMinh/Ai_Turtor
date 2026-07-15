import { API_BASE_URL, request } from './apiClient';
import { encodePath } from '../config/env';

export const profileApi = {
  async get(userId) {
    const params = new URLSearchParams({ userId });
    return request(`${API_BASE_URL}/users/profile?${params}`);
  },

  async update(userId, payload) {
    return request(`${API_BASE_URL}/users/${encodePath(userId)}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async changePassword(userId, payload) {
    return request(`${API_BASE_URL}/users/${encodePath(userId)}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },
};

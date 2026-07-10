import { API_BASE_URL, request } from './apiClient';

export const authApi = {
  async login(email, password) {
    const res = await request(`${API_BASE_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (res && res.token) {
      window.localStorage.setItem('ai_tutor_jwt', res.token);
    }
    return res;
  },

  async register(userData) {
    const res = await request(`${API_BASE_URL}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    if (res && res.token) {
      window.localStorage.setItem('ai_tutor_jwt', res.token);
    }
    return res;
  },
};

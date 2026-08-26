import { API_BASE_URL, request } from './apiClient';
import { encodePath } from '../config/env';
import { asArray } from './normalizers';
import { normalizeGoldQa } from './expertTrainingNormalizers';

const BASE = `${API_BASE_URL}/admin/indexed-teaching-notes`;

const query = (values = {}) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : '';
};

export const indexedTeachingNotesApi = {
  async list({ courseId, status } = {}) {
    const response = await request(`${BASE}${query({ courseId, status })}`);
    return asArray(response, 'items', 'content').map(normalizeGoldQa);
  },

  async update(id, payload) {
    return normalizeGoldQa(await request(`${BASE}/${encodePath(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
  },

  async reindex(id) {
    return normalizeGoldQa(await request(`${BASE}/${encodePath(id)}/reindex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }));
  },

  async unindex(id) {
    return normalizeGoldQa(await request(`${BASE}/${encodePath(id)}/unindex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }));
  },

  async remove(id) {
    return request(`${BASE}/${encodePath(id)}`, { method: 'DELETE' });
  },
};

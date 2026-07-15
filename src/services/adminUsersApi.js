import { API_BASE_URL, request, uploadRequest } from './apiClient';
import { asArray } from './normalizers';
import { encodePath } from '../config/env';

export const adminUsersApi = {
  async importMentors(formData) {
    return uploadRequest(`${API_BASE_URL}/mentors/import`, formData, 'Import failed');
  },

  async getAdminUsers(q = '', role = '', active = '') {
    const params = new URLSearchParams();
    if (q) params.append('q', q);
    if (role) params.append('role', role);
    if (active !== '') params.append('active', active);
    const qs = params.toString();
    return asArray(await request(`${API_BASE_URL}/admin/users${qs ? `?${qs}` : ''}`), 'users', 'content');
  },

  async updateAdminUser(userId, payload) {
    return request(`${API_BASE_URL}/admin/users/${encodePath(userId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async deleteAdminUser(userId) {
    return request(`${API_BASE_URL}/admin/users/${encodePath(userId)}`, { method: 'DELETE' });
  },

  async getMentors(category = '') {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    const query = params.toString();
    return asArray(await request(`${API_BASE_URL}/mentors${query ? `?${query}` : ''}`), 'mentors', 'content');
  },

  async getAdminMentors(q = '') {
    const params = new URLSearchParams();
    if (q) params.append('q', q);
    const query = params.toString();
    return asArray(await request(`${API_BASE_URL}/admin/mentors${query ? `?${query}` : ''}`), 'mentors', 'content');
  },

  async updateAdminMentor(mentorId, payload) {
    return request(`${API_BASE_URL}/admin/mentors/${encodePath(mentorId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async deleteAdminMentor(mentorId) {
    return request(`${API_BASE_URL}/admin/mentors/${encodePath(mentorId)}`, { method: 'DELETE' });
  },

  async getAdminEscalations(status = '') {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    const query = params.toString();
    return asArray(
      await request(`${API_BASE_URL}/admin/mentor-escalations${query ? `?${query}` : ''}`),
      'escalations',
      'content',
    );
  },

  async deleteAdminEscalation(escalationId) {
    return request(`${API_BASE_URL}/admin/mentor-escalations/${encodePath(escalationId)}`, {
      method: 'DELETE',
    });
  },
};

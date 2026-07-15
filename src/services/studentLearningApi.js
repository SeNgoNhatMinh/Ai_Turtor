import { API_BASE_URL, request } from './apiClient';
import { encodePath } from '../config/env';
import { asArray, normalizeImprovePlan } from './normalizers';

export const studentLearningApi = {
  async getStudentDashboard(studentId, courseId = '') {
    const params = new URLSearchParams();
    if (courseId) params.append('courseId', courseId);
    const qs = params.toString();
    return request(`${API_BASE_URL}/students/${encodePath(studentId)}/dashboard${qs ? `?${qs}` : ''}`);
  },

  async getStudentMemory(studentId, courseId) {
    return request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/memory`);
  },

  async updateStudentMemory(studentId, courseId, payload) {
    return request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/memory`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async getSuggestions(studentId, courseId, options = {}) {
    return request(`${API_BASE_URL}/tutor/improve-suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        courseId,
        ...(options.classId ? { classId: options.classId } : {}),
        ...(options.question ? { question: options.question } : {}),
        includeAiSuggestion: Boolean(options.includeAiSuggestion),
      }),
    });
  },

  async pinImproveSuggestion(studentId, courseId, suggestion) {
    return request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/memory/pinned-suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestion }),
    });
  },

  async unpinImproveSuggestion(studentId, courseId, suggestion) {
    const params = new URLSearchParams({ suggestion });
    return request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/memory/pinned-suggestions?${params}`, {
      method: 'DELETE',
    });
  },

  async learnSuggestion(studentId, courseId, payload) {
    return request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/suggestions/learn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async getImprovePlans(studentId, courseId = '') {
    const params = new URLSearchParams();
    if (courseId) params.append('courseId', courseId);
    const query = params.toString();
    return asArray(
      await request(`${API_BASE_URL}/students/${encodePath(studentId)}/improve-plans${query ? `?${query}` : ''}`),
      'plans',
      'content',
    ).map(normalizeImprovePlan);
  },

  async getLatestImprovePlan(studentId, courseId) {
    const data = await request(`${API_BASE_URL}/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/improve-plan`);
    return data?.plan === '' ? null : normalizeImprovePlan(data);
  },

  async completeImprovePlan(planId) {
    return normalizeImprovePlan(await request(`${API_BASE_URL}/improve-plans/${encodePath(planId)}/complete`, {
      method: 'PUT',
    }));
  },
};

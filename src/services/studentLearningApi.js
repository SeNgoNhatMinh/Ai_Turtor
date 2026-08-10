import { API_BASE_URL, request } from './apiClient';
import { encodePath } from '../config/env';
import { asArray, normalizeImprovePlan } from './normalizers';

// Tomcat rejects oversized request lines before Spring Security/CORS can run.
// Keep enough room for the path and headers when the legacy suggestion itself
// is a large JSON envelope.
const MAX_SAFE_SUGGESTION_QUERY_LENGTH = 3500;

const removeExactSuggestion = (items, suggestion) => {
  const normalized = String(suggestion || '').trim().toLowerCase();
  return (Array.isArray(items) ? items : []).filter(
    (item) => String(item || '').trim().toLowerCase() !== normalized,
  );
};

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

  async deleteImproveSuggestion(studentId, courseId, suggestion) {
    const params = new URLSearchParams({ suggestion });
    const memoryUrl = `${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/memory`;
    const deleteUrl = `${memoryUrl}/improve-suggestions?${params.toString()}`;

    if (deleteUrl.length > MAX_SAFE_SUGGESTION_QUERY_LENGTH) {
      const memory = await request(memoryUrl);
      return request(memoryUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          improveSuggestions: removeExactSuggestion(memory?.improveSuggestions, suggestion),
          pinnedImproveSuggestions: removeExactSuggestion(memory?.pinnedImproveSuggestions, suggestion),
        }),
      });
    }

    return request(deleteUrl, {
      method: 'DELETE',
      // A failed item deletion must not invalidate an otherwise valid login session.
      skipUnauthorizedRedirect: true,
    });
  },

  async unpinImproveSuggestion(studentId, courseId, suggestion) {
    const params = new URLSearchParams({ suggestion });
    return request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/memory/pinned-suggestions?${params.toString()}`, {
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

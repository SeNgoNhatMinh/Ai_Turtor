import { API_BASE_URL, API_TIMEOUTS, request } from './apiClient';
import { encodePath } from '../config/env';
import {
  asArray,
  normalizeQuizAssignment,
  normalizeQuizSession,
  normalizeTeacherQuizAttempt,
} from './normalizers';
import { getCachedResource, invalidateResourceCache } from './requestCache';

const quizCachePrefix = (studentId, courseId) => `quizzes:${studentId}:${courseId}`;

const normalizeListResponse = (data, keys, normalizer) => {
  const list = asArray(data, ...keys);
  if (list.length) return list.map(normalizer);
  if (data && typeof data === 'object' && (data.id || data.quizSessionId || data.sessionId || data.assignmentId)) {
    return [normalizer(data)];
  }
  return [];
};

export const quizApi = {
  async generateSelfQuiz(studentId, courseId, payload) {
    const quiz = normalizeQuizSession(await request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/quizzes/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: API_TIMEOUTS.quizGeneration,
    }));
    invalidateResourceCache(quizCachePrefix(studentId, courseId));
    return quiz;
  },

  async getStudentQuizHistory(studentId, courseId, options = {}) {
    const loader = async () => normalizeListResponse(
      await request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/quizzes`, { signal: options.signal }),
      ['quizzes', 'quizSessions', 'sessions', 'history', 'items', 'content', 'data', 'results'],
      normalizeQuizSession,
    );
    if (options.signal) return loader();
    return getCachedResource(`${quizCachePrefix(studentId, courseId)}:history`, loader, { force: options.force });
  },

  async getAssignedQuizzes(studentId, courseId, classId = '', options = {}) {
    const params = new URLSearchParams();
    if (classId) params.append('classId', classId);
    const qs = params.toString();
    const loader = async () => normalizeListResponse(
      await request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/quiz-assignments${qs ? `?${qs}` : ''}`, { signal: options.signal }),
      ['assignments', 'quizAssignments', 'assignedQuizzes', 'items', 'content', 'data', 'results'],
      normalizeQuizAssignment,
    );
    if (options.signal) return loader();
    return getCachedResource(`${quizCachePrefix(studentId, courseId)}:assigned:${classId}`, loader, { force: options.force });
  },

  async getQuiz(quizSessionId) {
    return normalizeQuizSession(await request(`${API_BASE_URL}/tutor/quizzes/${encodePath(quizSessionId)}`));
  },

  async submitQuiz(quizSessionId, payload) {
    const quiz = normalizeQuizSession(await request(`${API_BASE_URL}/tutor/quizzes/${encodePath(quizSessionId)}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: API_TIMEOUTS.ai,
    }));
    invalidateResourceCache('quizzes:');
    return quiz;
  },

  async startQuizAssignmentAttempt(assignmentId, studentId) {
    const params = new URLSearchParams({ studentId });
    const quiz = normalizeQuizSession(await request(`${API_BASE_URL}/tutor/quiz-assignments/${encodePath(assignmentId)}/attempts?${params}`, {
      method: 'POST',
      timeoutMs: API_TIMEOUTS.ai,
    }));
    invalidateResourceCache(`quizzes:${studentId}:`);
    return quiz;
  },

  async teacherReviewQuiz(quizSessionId, payload) {
    return request(`${API_BASE_URL}/tutor/quizzes/${encodePath(quizSessionId)}/teacher-review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: API_TIMEOUTS.ai,
    });
  },

  async getTeacherQuizAttempts(teacherId, filters = {}, options = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    });
    const response = await request(
      `${API_BASE_URL}/tutor/teachers/${encodePath(teacherId)}/quiz-attempts?${params}`,
      { signal: options.signal },
    );
    return {
      teacherId: response?.teacherId || teacherId,
      page: Number(response?.page) || 0,
      size: Number(response?.size) || Number(filters.size) || 20,
      totalElements: Number(response?.totalElements) || 0,
      totalPages: Number(response?.totalPages) || 0,
      attempts: asArray(response, 'attempts', 'content', 'items').map(normalizeTeacherQuizAttempt),
    };
  },

  async getTeacherQuizAssignments(teacherId) {
    return asArray(
      await request(`${API_BASE_URL}/tutor/teachers/${encodePath(teacherId)}/quiz-assignments`),
      'assignments',
      'content',
    );
  },

  async generateTeacherQuizDraft(teacherId, courseId, payload) {
    return request(`${API_BASE_URL}/tutor/teachers/${encodePath(teacherId)}/courses/${encodePath(courseId)}/quiz-assignments/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: API_TIMEOUTS.quizGeneration,
    });
  },

  async updateQuizAssignment(assignmentId, payload) {
    return request(`${API_BASE_URL}/tutor/quiz-assignments/${encodePath(assignmentId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async deleteQuizAssignment(assignmentId) {
    return request(`${API_BASE_URL}/tutor/quiz-assignments/${encodePath(assignmentId)}`, {
      method: 'DELETE',
    });
  },

  async publishQuizAssignment(assignmentId, payload) {
    return request(`${API_BASE_URL}/tutor/quiz-assignments/${encodePath(assignmentId)}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },
};

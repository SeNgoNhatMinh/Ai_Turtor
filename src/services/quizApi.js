import { API_BASE_URL, API_TIMEOUTS, request } from './apiClient';
import { encodePath } from '../config/env';
import { asArray, normalizeQuizAssignment, normalizeQuizSession } from './normalizers';

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
    return normalizeQuizSession(await request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/quizzes/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: API_TIMEOUTS.quizGeneration,
    }));
  },

  async getStudentQuizHistory(studentId, courseId) {
    return normalizeListResponse(
      await request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/quizzes`),
      ['quizzes', 'quizSessions', 'sessions', 'history', 'items', 'content', 'data', 'results'],
      normalizeQuizSession,
    );
  },

  async getAssignedQuizzes(studentId, courseId, classId = '') {
    const params = new URLSearchParams();
    if (classId) params.append('classId', classId);
    const qs = params.toString();
    return normalizeListResponse(
      await request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/quiz-assignments${qs ? `?${qs}` : ''}`),
      ['assignments', 'quizAssignments', 'assignedQuizzes', 'items', 'content', 'data', 'results'],
      normalizeQuizAssignment,
    );
  },

  async getQuiz(quizSessionId) {
    return normalizeQuizSession(await request(`${API_BASE_URL}/tutor/quizzes/${encodePath(quizSessionId)}`));
  },

  async submitQuiz(quizSessionId, payload) {
    return normalizeQuizSession(await request(`${API_BASE_URL}/tutor/quizzes/${encodePath(quizSessionId)}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: API_TIMEOUTS.ai,
    }));
  },

  async startQuizAssignmentAttempt(assignmentId, studentId) {
    const params = new URLSearchParams({ studentId });
    return normalizeQuizSession(await request(`${API_BASE_URL}/tutor/quiz-assignments/${encodePath(assignmentId)}/attempts?${params}`, {
      method: 'POST',
      timeoutMs: API_TIMEOUTS.ai,
    }));
  },

  async teacherReviewQuiz(quizSessionId, payload) {
    return request(`${API_BASE_URL}/tutor/quizzes/${encodePath(quizSessionId)}/teacher-review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: API_TIMEOUTS.ai,
    });
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

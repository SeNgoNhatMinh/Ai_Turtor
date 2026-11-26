import { API_BASE_URL, API_TIMEOUTS, request } from './apiClient';
import { encodePath } from '../config/env';
import { queryKeys } from '../app/queryKeys';
import { asArray, normalizeQuizSession } from './normalizers';
import { fetchServerQuery, invalidateServerQueries } from './queryCache';

const normalizeListResponse = (data, keys, normalizer) => {
  const list = asArray(data, ...keys);
  if (list.length) return list.map(normalizer);
  if (data && typeof data === 'object' && (data.id || data.quizSessionId || data.sessionId)) {
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
    invalidateServerQueries(['quizzes', studentId, courseId]);
    return quiz;
  },

  async getStudentQuizHistory(studentId, courseId, options = {}) {
    const loader = async ({ signal } = {}) => normalizeListResponse(
      await request(`${API_BASE_URL}/tutor/students/${encodePath(studentId)}/courses/${encodePath(courseId)}/quizzes`, { signal: options.signal || signal }),
      ['quizzes', 'quizSessions', 'sessions', 'history', 'items', 'content', 'data', 'results'],
      normalizeQuizSession,
    );
    if (options.signal) return loader();
    return fetchServerQuery(queryKeys.studentQuizHistory(studentId, courseId), loader, { force: options.force });
  },

  async getQuiz(quizSessionId, options = {}) {
    return normalizeQuizSession(await request(
      `${API_BASE_URL}/tutor/quizzes/${encodePath(quizSessionId)}`,
      { signal: options.signal },
    ));
  },

  async submitQuiz(quizSessionId, payload) {
    const quiz = normalizeQuizSession(await request(`${API_BASE_URL}/tutor/quizzes/${encodePath(quizSessionId)}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: API_TIMEOUTS.ai,
    }));
    invalidateServerQueries(['quizzes']);
    return quiz;
  },
};

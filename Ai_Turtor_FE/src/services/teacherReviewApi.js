import { API_BASE_URL, request } from './apiClient';
import { asArray } from './normalizers';
import { encodePath } from '../config/env';
import { normalizeReviewMode } from '../utils/validators';

export const teacherReviewApi = {
  async getEscalationDetail(escalationId) {
    return request(`${API_BASE_URL}/tutor/escalations/${encodePath(escalationId)}`);
  },

  async getTeacherEscalations(teacherId, filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    const qs = params.toString();
    return request(`${API_BASE_URL}/tutor/escalations/teachers/${encodePath(teacherId)}${qs ? `?${qs}` : ''}`);
  },

  async answerEscalation(escalationId, payload) {
    return request(`${API_BASE_URL}/tutor/escalations/${encodePath(escalationId)}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async hideEscalationFromTeacherInbox(escalationId) {
    return request(`${API_BASE_URL}/tutor/escalations/${encodePath(escalationId)}/teacher-inbox`, {
      method: 'DELETE',
      // A route/configuration error on this optional inbox action must not clear
      // an otherwise valid teacher session and reload the whole app to login.
      skipUnauthorizedRedirect: true,
    });
  },

  async submitAnswerReview(payload) {
    return request(`${API_BASE_URL}/tutor/answer-reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, mode: normalizeReviewMode(payload?.mode) }),
    });
  },

  async getMentorPendingAnswerReviewQueue(courseId = '') {
    const params = courseId ? `?courseId=${encodeURIComponent(courseId)}` : '';
    const data = await request(`${API_BASE_URL}/tutor/answer-reviews/mentor-pending${params}`);
    return {
      groups: asArray(data, 'groups'),
      reviews: asArray(data, 'reviews', 'content'),
      groupCount: Number(data?.groupCount ?? asArray(data, 'groups').length) || 0,
      count: Number(data?.count ?? asArray(data, 'reviews', 'content').length) || 0,
    };
  },

  async getSeniorPendingAnswerReviewQueue(courseId = '') {
    const params = courseId ? `?courseId=${encodeURIComponent(courseId)}` : '';
    const data = await request(`${API_BASE_URL}/tutor/answer-reviews/senior-pending${params}`);
    return {
      groups: asArray(data, 'groups'),
      reviews: asArray(data, 'reviews', 'content'),
      groupCount: Number(data?.groupCount ?? asArray(data, 'groups').length) || 0,
      count: Number(data?.count ?? asArray(data, 'reviews', 'content').length) || 0,
    };
  },

  /** @deprecated Use getMentorPendingAnswerReviewQueue */
  async getMentorPendingAnswerReviews(courseId = '') {
    const queue = await this.getMentorPendingAnswerReviewQueue(courseId);
    return queue.reviews;
  },

  /** @deprecated Use getSeniorPendingAnswerReviewQueue */
  async getSeniorPendingAnswerReviews(courseId = '') {
    const queue = await this.getSeniorPendingAnswerReviewQueue(courseId);
    return queue.reviews;
  },

  async getAnswerReviews(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    });
    const query = params.toString();
    return asArray(
      await request(`${API_BASE_URL}/tutor/answer-reviews${query ? `?${query}` : ''}`),
      'reviews',
      'content',
      'items',
    );
  },

  async seniorResolveAnswerReview(reviewId, payload) {
    return request(`${API_BASE_URL}/tutor/answer-reviews/${encodePath(reviewId)}/senior-resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async getKnowledgeCandidates(status = '', courseId = '') {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (courseId) params.append('courseId', courseId);
    return asArray(
      await request(`${API_BASE_URL}/tutor/escalations/knowledge-candidates?${params}`),
      'candidates',
      'content',
    );
  },

  async approveCandidate(candidateId, payload = {}) {
    return request(`${API_BASE_URL}/tutor/escalations/knowledge-candidates/${encodePath(candidateId)}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async rejectCandidate(candidateId, payload = {}) {
    return request(`${API_BASE_URL}/tutor/escalations/knowledge-candidates/${encodePath(candidateId)}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },
};

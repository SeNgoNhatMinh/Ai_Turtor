import { API_BASE_URL, request } from './apiClient';
import { encodePath } from '../config/env';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function queryString(values) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

function studentBase(studentId) {
  return `${API_BASE_URL}/teacher/students/${encodePath(studentId)}/teaching`;
}

export const teachingBehaviorApi = {
  async list(filters = {}, options = {}) {
    const data = await request(`${API_BASE_URL}/teacher/teaching-behaviors${queryString(filters)}`, {
      signal: options.signal,
    });
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      totalElements: Number(data?.totalElements) || 0,
      page: Number(data?.page) || 0,
      size: Number(data?.size) || 20,
    };
  },

  async create(payload) {
    return request(`${API_BASE_URL}/teacher/teaching-behaviors`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
  },

  async update(id, payload) {
    return request(`${API_BASE_URL}/teacher/teaching-behaviors/${encodePath(id)}`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
  },

  async overview(options = {}) {
    return request(`${API_BASE_URL}/teacher/teaching-behaviors/overview`, { signal: options.signal });
  },

  async assignments(id, options = {}) {
    return request(`${API_BASE_URL}/teacher/teaching-behaviors/${encodePath(id)}/assignments`, {
      signal: options.signal,
    });
  },

  async assign(id, payload) {
    return request(`${API_BASE_URL}/teacher/teaching-behaviors/${encodePath(id)}/assign`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
  },

  async behaviorExecutions(id, options = {}) {
    return request(`${API_BASE_URL}/teacher/teaching-behaviors/${encodePath(id)}/executions`, {
      signal: options.signal,
    });
  },

  async versions(id, options = {}) {
    return request(`${API_BASE_URL}/teacher/teaching-behaviors/${encodePath(id)}/versions`, {
      signal: options.signal,
    });
  },

  async rollback(id, version) {
    return request(`${API_BASE_URL}/teacher/teaching-behaviors/${encodePath(id)}/rollback`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ version }),
    });
  },

  async testBehavior(id, payload) {
    return request(`${API_BASE_URL}/teacher/teaching-behaviors/${encodePath(id)}/test`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload || {}),
    });
  },

  async listApplied(filters = {}, options = {}) {
    const data = await request(`${API_BASE_URL}/teacher/applied-teaching-behaviors${queryString(filters)}`, {
      signal: options.signal,
    });
    return { items: Array.isArray(data?.items) ? data.items : [], totalElements: Number(data?.totalElements) || 0 };
  },

  async setAssignmentStatus(id, status) {
    return request(`${API_BASE_URL}/teacher/applied-teaching-behaviors/${encodePath(id)}/status`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ status }),
    });
  },

  async listExecutions(filters = {}, options = {}) {
    const data = await request(`${API_BASE_URL}/teacher/teaching-behavior-executions${queryString(filters)}`, {
      signal: options.signal,
    });
    return { items: Array.isArray(data?.items) ? data.items : [], totalElements: Number(data?.totalElements) || 0 };
  },

  async setStatus(id, status) {
    return request(`${API_BASE_URL}/teacher/teaching-behaviors/${encodePath(id)}/status`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ status }),
    });
  },

  async getStudentProfile(studentId, courseId, classId, options = {}) {
    return request(`${studentBase(studentId)}/profile${queryString({ courseId, classId })}`, {
      signal: options.signal,
    });
  },

  async updateStudentProfile(studentId, courseId, classId, payload) {
    return request(`${studentBase(studentId)}/profile${queryString({ courseId, classId })}`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
  },

  async getStudentBehaviors(studentId, courseId, classId, options = {}) {
    return request(`${studentBase(studentId)}/behaviors${queryString({ courseId, classId })}`, {
      signal: options.signal,
    });
  },

  async createStudentBehavior(studentId, courseId, classId, payload) {
    return request(`${studentBase(studentId)}/behaviors${queryString({ courseId, classId })}`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
  },

  async updateStudentBehavior(studentId, courseId, classId, behaviorId, payload) {
    return request(
      `${studentBase(studentId)}/behaviors/${encodePath(behaviorId)}${queryString({ courseId, classId })}`,
      {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
      },
    );
  },

  async setStudentBehaviorStatus(studentId, courseId, classId, behaviorId, status) {
    return request(
      `${studentBase(studentId)}/behaviors/${encodePath(behaviorId)}/status${queryString({ courseId, classId })}`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ status }),
      },
    );
  },

  /** action: pin | unpin | block | unblock */
  async changeStudentBehavior(studentId, courseId, classId, behaviorId, action) {
    return request(
      `${studentBase(studentId)}/behaviors/${encodePath(behaviorId)}/${action}${queryString({ courseId, classId })}`,
      { method: 'POST' },
    );
  },

  async previewStudent(studentId, courseId, classId, question, domain, options = {}) {
    return request(`${studentBase(studentId)}/preview${queryString({ courseId, classId, question, domain })}`, {
      signal: options.signal,
    });
  },
};

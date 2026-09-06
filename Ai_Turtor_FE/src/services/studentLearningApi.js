import { API_BASE_URL, request } from './apiClient';
import { encodePath } from '../config/env';

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
};

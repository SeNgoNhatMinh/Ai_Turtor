import { API_BASE_URL, request } from './apiClient';
import { encodePath } from '../config/env';

export const teacherApi = {
  async getCourses(teacherId) {
    return request(`${API_BASE_URL}/mentors/${encodePath(teacherId)}/courses`);
  },

  async getDashboard(teacherId, courseId = '', classId = '') {
    const params = new URLSearchParams();
    if (courseId) params.append('courseId', courseId);
    if (classId) params.append('classId', classId);
    const query = params.toString();
    return request(`${API_BASE_URL}/mentors/${encodePath(teacherId)}/dashboard${query ? `?${query}` : ''}`);
  },

  async getClassSections(teacherId) {
    return request(`${API_BASE_URL}/teachers/${encodePath(teacherId)}/classes`);
  },

  async getClassStudents(courseId, classId, teacherId = '', options = {}) {
    const params = new URLSearchParams();
    if (teacherId) params.append('teacherId', teacherId);
    if (options.page != null) params.set('page', String(options.page));
    if (options.size != null) params.set('size', String(options.size));
    if (options.query) params.set('query', String(options.query));
    const query = params.toString();
    // Teachers cannot call /api/academic/** (admin-only). Use the shared courses alias.
    return request(`${API_BASE_URL}/courses/${encodePath(courseId)}/class-sections/${encodePath(classId)}/students${query ? `?${query}` : ''}`);
  },

  async getCourseMemories(courseId, classId = '') {
    const params = new URLSearchParams();
    if (classId) params.append('classId', classId);
    const query = params.toString();
    return request(`${API_BASE_URL}/tutor/courses/${encodePath(courseId)}/memories${query ? `?${query}` : ''}`);
  },
};

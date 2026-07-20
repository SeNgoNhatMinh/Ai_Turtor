import { API_BASE_URL, request } from './apiClient';
import { encodePath } from '../config/env';

export const teacherApi = {
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

  async getClassStudents(courseId, classId, teacherId = '') {
    const params = new URLSearchParams();
    if (teacherId) params.append('teacherId', teacherId);
    const query = params.toString();
    return request(`${API_BASE_URL}/academic/courses/${encodePath(courseId)}/class-sections/${encodePath(classId)}/students${query ? `?${query}` : ''}`);
  },

  async getCourseMemories(courseId, classId = '') {
    const params = new URLSearchParams();
    if (classId) params.append('classId', classId);
    const query = params.toString();
    return request(`${API_BASE_URL}/tutor/courses/${encodePath(courseId)}/memories${query ? `?${query}` : ''}`);
  },
};

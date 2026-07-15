import { API_BASE_URL, blobRequest, request, uploadRequest } from './apiClient';
import { asArray } from './normalizers';
import { encodePath } from '../config/env';

export const adminAcademicApi = {
  async getSemesters() {
    return asArray(await request(`${API_BASE_URL}/admin/semesters`), 'semesters', 'content');
  },

  async getCourses() {
    return asArray(await request(`${API_BASE_URL}/courses`), 'courses', 'content');
  },

  async getClassSections(courseId) {
    return asArray(await request(`${API_BASE_URL}/academic/courses/${encodePath(courseId)}/class-sections`), 'classSections', 'classes', 'content');
  },

  async getStudentEnrollments(studentId) {
    return request(`${API_BASE_URL}/students/${encodePath(studentId)}/enrollments`);
  },

  async createSemester(payload) {
    return request(`${API_BASE_URL}/academic/semesters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async updateSemester(semesterCode, payload) {
    return request(`${API_BASE_URL}/admin/semesters/${encodePath(semesterCode)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async deleteSemester(semesterCode) {
    return request(`${API_BASE_URL}/admin/semesters/${encodePath(semesterCode)}`, { method: 'DELETE' });
  },

  async createCourse(payload) {
    return request(`${API_BASE_URL}/academic/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async updateCourse(courseId, payload) {
    return request(`${API_BASE_URL}/admin/courses/${encodePath(courseId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async deleteCourse(courseId) {
    return request(`${API_BASE_URL}/admin/courses/${encodePath(courseId)}`, { method: 'DELETE' });
  },

  async completeCourse(courseId) {
    return request(`${API_BASE_URL}/admin/courses/${encodePath(courseId)}/complete`, { method: 'PATCH' });
  },

  async createClassSection(payload) {
    return request(`${API_BASE_URL}/academic/class-sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async updateClassSection(courseId, classId, payload) {
    return request(`${API_BASE_URL}/admin/courses/${encodePath(courseId)}/class-sections/${encodePath(classId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async deleteClassSection(courseId, classId) {
    return request(`${API_BASE_URL}/admin/courses/${encodePath(courseId)}/class-sections/${encodePath(classId)}`, {
      method: 'DELETE',
    });
  },

  async completeClassSection(courseId, classId) {
    return request(`${API_BASE_URL}/admin/courses/${encodePath(courseId)}/class-sections/${encodePath(classId)}/complete`, {
      method: 'PATCH',
    });
  },

  async createEnrollment(payload) {
    return request(`${API_BASE_URL}/academic/enrollments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async updateEnrollment(enrollmentId, payload) {
    return request(`${API_BASE_URL}/admin/enrollments/${encodePath(enrollmentId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async deleteEnrollment(enrollmentId) {
    return request(`${API_BASE_URL}/admin/enrollments/${encodePath(enrollmentId)}`, { method: 'DELETE' });
  },

  async removeStudentFromClass(courseId, classId, studentId) {
    return request(`${API_BASE_URL}/courses/${encodePath(courseId)}/class-sections/${encodePath(classId)}/students/${encodePath(studentId)}`, {
      method: 'DELETE',
    });
  },

  async downloadStudentImportTemplate() {
    return blobRequest(`${API_BASE_URL}/admin/class-sections/students/import/template.xlsx`);
  },

  async importClassStudents(courseId, classId, formData, options = {}) {
    const params = new URLSearchParams();
    if (options.semesterId) params.append('semesterId', options.semesterId);
    if (options.courseName) params.append('courseName', options.courseName);
    if (options.status) params.append('status', options.status);
    if (options.dryRun != null) params.append('dryRun', String(options.dryRun));
    const qs = params.toString();
    return uploadRequest(`${API_BASE_URL}/admin/class-sections/${encodePath(courseId)}/${encodePath(classId)}/students/import${qs ? `?${qs}` : ''}`, formData, 'Student import failed');
  },
};

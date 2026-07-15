import { API_BASE_URL, blobRequest, request, uploadRequest } from './apiClient';
import { encodePath } from '../config/env';

export const assignmentApi = {
  async getStudentAssignments(studentId) {
    return request(`${API_BASE_URL}/students/${encodePath(studentId)}/assignments`);
  },

  async submitAssignment(assignmentId, formData, studentId) {
    const note = formData.get('note');
    const params = new URLSearchParams({ studentId });
    if (note) params.append('note', note);
    return uploadRequest(`${API_BASE_URL}/students/assignments/${encodePath(assignmentId)}/submit?${params}`, formData, 'Submit failed');
  },

  async uploadAssignment(courseId, classId, formData) {
    return uploadRequest(`${API_BASE_URL}/mentor/courses/${encodePath(courseId)}/classes/${encodePath(classId)}/assignments/upload`, formData, 'Upload assignment failed');
  },

  async getClassAssignments(courseId, classId, teacherId) {
    return request(`${API_BASE_URL}/mentor/courses/${encodePath(courseId)}/classes/${encodePath(classId)}/assignments?teacherId=${encodeURIComponent(teacherId)}`);
  },

  async getClassSubmissions(courseId, classId, teacherId) {
    return request(`${API_BASE_URL}/mentor/courses/${encodePath(courseId)}/classes/${encodePath(classId)}/submissions?teacherId=${encodeURIComponent(teacherId)}`);
  },

  async gradeSubmission(submissionId, payload) {
    return request(`${API_BASE_URL}/mentor/submissions/${encodePath(submissionId)}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async downloadAssignmentFile(assignmentId) {
    return blobRequest(`${API_BASE_URL}/assignments/${encodePath(assignmentId)}/file`);
  },

  async deleteAssignment(assignmentId, teacherId = '') {
    const params = new URLSearchParams();
    if (teacherId) params.append('teacherId', teacherId);
    const query = params.toString();
    return request(`${API_BASE_URL}/mentor/assignments/${encodePath(assignmentId)}${query ? `?${query}` : ''}`, {
      method: 'DELETE',
    });
  },
};

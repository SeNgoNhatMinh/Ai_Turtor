import { API_BASE_URL, blobRequest, request, uploadRequest } from './apiClient';
import { encodePath } from '../config/env';
import { ApiError } from './httpClient';

export function assertAssignmentUploadReceipt(response) {
  const assignmentId = response?.assignmentId || response?.id || response?._id;
  if (assignmentId) return response;
  throw new ApiError({
    status: 502,
    code: 'INVALID_ASSIGNMENT_UPLOAD_RESPONSE',
    message: 'Máy chủ không xác nhận bài tập đã xuất bản.',
    userMessage: 'Máy chủ chưa xác nhận bài tập đã xuất bản. Hãy kiểm tra danh sách bài tập trước khi thử lại.',
    details: response,
  });
}

export const assignmentApi = {
  async getStudentAssignments(studentId, courseId = '') {
    const params = new URLSearchParams();
    if (courseId) params.append('courseId', courseId);
    const query = params.toString();
    return request(`${API_BASE_URL}/students/${encodePath(studentId)}/assignments${query ? `?${query}` : ''}`);
  },

  async getStudentSubmissions(studentId, courseId = '') {
    const params = new URLSearchParams();
    if (courseId) params.append('courseId', courseId);
    const query = params.toString();
    return request(`${API_BASE_URL}/students/${encodePath(studentId)}/submissions${query ? `?${query}` : ''}`);
  },

  async getAssignmentDetail(assignmentId) {
    return request(`${API_BASE_URL}/assignments/${encodePath(assignmentId)}`);
  },

  async updateAssignment(assignmentId, payload) {
    return request(`${API_BASE_URL}/mentor/assignments/${encodePath(assignmentId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async submitAssignment(assignmentId, formData, student) {
    const identity = typeof student === 'object' && student !== null
      ? student
      : { studentId: student };
    const note = formData.get('note');
    const params = new URLSearchParams({ studentId: String(identity.studentId || '') });
    if (identity.studentName) params.append('studentName', identity.studentName);
    if (identity.studentEmail) params.append('studentEmail', identity.studentEmail);
    if (note) params.append('note', note);
    return uploadRequest(`${API_BASE_URL}/students/assignments/${encodePath(assignmentId)}/submit?${params}`, formData, 'Nộp bài thất bại');
  },

  async uploadAssignment(courseId, classId, formData) {
    const response = await uploadRequest(
      `${API_BASE_URL}/mentor/courses/${encodePath(courseId)}/classes/${encodePath(classId)}/assignments/upload`,
      formData,
      'Tải bài tập thất bại',
      { timeoutMs: 180000 },
    );
    return assertAssignmentUploadReceipt(response);
  },

  async getClassAssignments(courseId, classId, teacherId) {
    return request(`${API_BASE_URL}/mentor/courses/${encodePath(courseId)}/classes/${encodePath(classId)}/assignments?teacherId=${encodeURIComponent(teacherId)}`);
  },

  async getClassSubmissions(courseId, classId, teacherId) {
    return request(`${API_BASE_URL}/mentor/courses/${encodePath(courseId)}/classes/${encodePath(classId)}/submissions?teacherId=${encodeURIComponent(teacherId)}`);
  },

  async getAssignmentSubmissions(assignmentId, teacherId) {
    const params = new URLSearchParams({ teacherId });
    return request(`${API_BASE_URL}/mentor/assignments/${encodePath(assignmentId)}/submissions?${params}`);
  },

  async gradeSubmission(submissionId, payload) {
    return request(`${API_BASE_URL}/mentor/submissions/${encodePath(submissionId)}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async uploadAssignmentAnswerKey(assignmentId, teacherId, file) {
    const params = new URLSearchParams({ teacherId });
    const formData = new FormData();
    formData.append('file', file);
    return uploadRequest(
      `${API_BASE_URL}/mentor/assignments/${encodePath(assignmentId)}/answer-key?${params}`,
      formData,
      'Tải đáp án thất bại',
      { timeoutMs: 180000 },
    );
  },

  async aiGradeAssignmentSubmission(submissionId, teacherId, options = {}) {
    const params = new URLSearchParams({ teacherId });
    return request(`${API_BASE_URL}/mentor/assignment-submissions/${encodePath(submissionId)}/ai-grade?${params}`, {
      method: 'POST',
      timeoutMs: 300000,
      ...options,
    });
  },

  async downloadAssignmentFile(assignmentId) {
    return blobRequest(`${API_BASE_URL}/assignments/${encodePath(assignmentId)}/file`);
  },

  async downloadSubmissionFile(submissionId) {
    return blobRequest(`${API_BASE_URL}/submissions/${encodePath(submissionId)}/file`);
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

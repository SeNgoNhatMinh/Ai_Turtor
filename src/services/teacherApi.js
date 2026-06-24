import { apiService } from './api';

export const teacherApi = {
  getTeacherDashboard: apiService.getTeacherDashboard,
  getTeacherClassSections: apiService.getTeacherClassSections,
  getTeacherCourses: apiService.getTeacherCourses,
  getTeacherEscalationInbox: apiService.getTeacherEscalationInbox,
  getClassStudents: apiService.getClassStudents,
  getClassAssignments: apiService.getClassAssignments,
  getClassSubmissions: apiService.getClassSubmissions,
  getAssignmentSubmissions: apiService.getAssignmentSubmissions,
  gradeSubmission: apiService.gradeSubmission,
  uploadAssignment: apiService.uploadAssignment,
};

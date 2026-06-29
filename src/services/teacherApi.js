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
  getAssignment: apiService.getAssignment,
  updateAssignment: apiService.updateAssignment,
  deleteAssignment: apiService.deleteAssignment,
  gradeSubmission: apiService.gradeSubmission,
  uploadAssignment: apiService.uploadAssignment,
  generateTeacherQuizDraft: apiService.generateTeacherQuizDraft,
  updateQuizAssignment: apiService.updateQuizAssignment,
  deleteQuizAssignment: apiService.deleteQuizAssignment,
  publishQuizAssignment: apiService.publishQuizAssignment,
  getTeacherQuizAssignments: apiService.getTeacherQuizAssignments,
  teacherReviewQuiz: apiService.teacherReviewQuiz,
};

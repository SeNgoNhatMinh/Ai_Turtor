import { apiService } from './api';

export const studentApi = {
  getStudentAssignments: apiService.getStudentAssignments,
  submitAssignment: apiService.submitAssignment,
  getStudentSubmissions: apiService.getStudentSubmissions,
  getStudentDashboard: apiService.getStudentDashboard,
  getStudentMemory: apiService.getStudentMemory,
  updateStudentMemory: apiService.updateStudentMemory,
  pinImproveSuggestion: apiService.pinImproveSuggestion,
  unpinImproveSuggestion: apiService.unpinImproveSuggestion,
  getSuggestions: apiService.getSuggestions,
  getImprovePlans: apiService.getImprovePlans,
  getLatestImprovePlan: apiService.getLatestImprovePlan,
  completeImprovePlan: apiService.completeImprovePlan,
};

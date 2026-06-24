import { apiService } from './api';

export const adminApi = {
  getAdminStats: apiService.getAdminStats,
  getSubscriptionPlans: apiService.getSubscriptionPlans,
  updateSubscriptionPlan: apiService.updateSubscriptionPlan,
  deleteSubscriptionPlan: apiService.deleteSubscriptionPlan,
  getAdminUsers: apiService.getAdminUsers,
  updateAdminUser: apiService.updateAdminUser,
  deleteAdminUser: apiService.deleteAdminUser,
  getAdminMentors: apiService.getAdminMentors,
  updateAdminMentor: apiService.updateAdminMentor,
  deleteAdminMentor: apiService.deleteAdminMentor,
  getAdminEscalations: apiService.getAdminEscalations,
  deleteAdminEscalation: apiService.deleteAdminEscalation,
  getAdminSubscriptions: apiService.getAdminSubscriptions,
  assignSubscription: apiService.assignSubscription,
  deleteSubscription: apiService.deleteSubscription,
  updateSubscriptionStatus: apiService.updateSubscriptionStatus,
  runDiagnostics: apiService.runDiagnostics,
  importMentors: apiService.importMentors,
  getMentorImportTemplateSpec: apiService.getMentorImportTemplateSpec,
  downloadMentorImportTemplate: apiService.downloadMentorImportTemplate,
};

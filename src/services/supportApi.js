import { apiService } from './api';

export const supportApi = {
  createEscalation: apiService.createEscalation,
  answerEscalation: apiService.answerEscalation,
  getEscalationHistory: apiService.getEscalationHistory,
  cancelEscalation: apiService.cancelEscalation,
  offerEscalation: apiService.offerEscalation,
  selectEscalationMentor: apiService.selectEscalationMentor,
  submitAnswerReview: apiService.submitAnswerReview,
};

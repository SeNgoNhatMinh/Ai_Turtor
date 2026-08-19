import { expertTrainingApi } from '../../services/expertTrainingApi';

export const expertTrainingGateway = {
  async analyzeCoverage(payload) {
    return expertTrainingApi.analyzeCoverage(payload);
  },

  async submitGoldQa(payload) {
    return expertTrainingApi.submitGoldQa(payload);
  },

  async submitRubric(payload) {
    return expertTrainingApi.submitRubric(payload);
  },

  async reviewGoldQa(itemId, decision, payload) {
    return expertTrainingApi.reviewGoldQa(itemId, decision, payload);
  },

  async reviewRubric(itemId, decision, payload) {
    return expertTrainingApi.reviewRubric(itemId, decision, payload);
  },

  async startEvaluation(payload) {
    return expertTrainingApi.startEvaluation(payload);
  },
};

import { asArray } from '../../services/normalizers';
import {
  normalizeCoverageGap,
  normalizeEvalRun,
  normalizeGoldQa,
  normalizeRubric,
} from '../../services/expertTrainingNormalizers';
import { expertTrainingApi } from '../../services/expertTrainingApi';
import { N8N_ENABLED, N8N_TUTOR_V2_ENABLED } from '../../services/n8nClient';
import { n8nService } from '../../services/n8nService';

export const isTutorV2HarnessEnabled = () => N8N_ENABLED && N8N_TUTOR_V2_ENABLED;

export const expertTrainingGateway = {
  async analyzeCoverage(payload) {
    if (!isTutorV2HarnessEnabled()) return expertTrainingApi.analyzeCoverage(payload);
    const response = await n8nService.analyzeTutorV2Coverage(payload);
    return asArray(response, 'gaps', 'content').map(normalizeCoverageGap);
  },

  async submitGoldQa(payload) {
    if (!isTutorV2HarnessEnabled()) return expertTrainingApi.submitGoldQa(payload);
    return normalizeGoldQa(await n8nService.submitTutorV2GoldQa(payload));
  },

  async submitRubric(payload) {
    if (!isTutorV2HarnessEnabled()) return expertTrainingApi.submitRubric(payload);
    return normalizeRubric(await n8nService.submitTutorV2Rubric(payload));
  },

  async reviewGoldQa(itemId, decision, payload) {
    if (!isTutorV2HarnessEnabled() || decision !== 'approve') {
      return expertTrainingApi.reviewGoldQa(itemId, decision, payload);
    }
    return normalizeGoldQa(await n8nService.approveTutorV2GoldQa({
      goldQaId: itemId,
      ...payload,
    }));
  },

  async reviewRubric(itemId, decision, payload) {
    if (!isTutorV2HarnessEnabled() || decision !== 'approve') {
      return expertTrainingApi.reviewRubric(itemId, decision, payload);
    }
    return normalizeRubric(await n8nService.approveTutorV2Rubric({
      rubricId: itemId,
      ...payload,
    }));
  },

  async startEvaluation(payload) {
    if (!isTutorV2HarnessEnabled()) return expertTrainingApi.startEvaluation(payload);
    return normalizeEvalRun(await n8nService.runTutorV2Evaluation(payload));
  },
};

import { normalizeGoldQa } from '../../services/expertTrainingNormalizers';
import { expertTrainingApi } from '../../services/expertTrainingApi';
import { N8N_ENABLED, N8N_TUTOR_V2_ENABLED } from '../../services/n8nClient';
import { n8nService } from '../../services/n8nService';

const isTutorV2HarnessEnabled = () => N8N_ENABLED && N8N_TUTOR_V2_ENABLED;

export const expertTrainingGateway = {
  async startChapter(payload) {
    return expertTrainingApi.startChapter(payload);
  },

  async analyzeCoverage(payload) {
    return expertTrainingApi.analyzeCoverage(payload);
  },

  async submitGoldQa(payload, options = {}) {
    // Default: persist DRAFT only. Opt-in exam=true runs baseline exam after save.
    const exam = options.exam === true;
    const saved = normalizeGoldQa(await expertTrainingApi.submitGoldQa(payload, { exam: false }));
    if (!exam) return saved;
    return this.examGoldQa(saved.id);
  },

  async examGoldQa(goldQaId) {
    if (!isTutorV2HarnessEnabled()) return expertTrainingApi.examGoldQa(goldQaId);
    return normalizeGoldQa(await n8nService.examTutorV2GoldQa({ goldQaId }));
  },

  async deleteGoldQa(goldQaId, authorId) {
    return expertTrainingApi.deleteGoldQa(goldQaId, authorId);
  },

  async sendGoldQaForReview(goldQaId) {
    if (!isTutorV2HarnessEnabled()) return expertTrainingApi.sendGoldQaForReview(goldQaId);
    return normalizeGoldQa(await n8nService.sendTutorV2GoldQaForReview({ goldQaId }));
  },

  async submitRubric(payload) {
    return expertTrainingApi.submitRubric(payload);
  },

  async reviewGoldQa(itemId, decision, payload) {
    // Indexing is a database mutation. Call the API directly so an n8n
    // workflow cannot report success while the Gold Q&A stays pending.
    const saved = await expertTrainingApi.reviewGoldQa(itemId, decision, payload);
    if (decision !== 'approve') return saved;
    const status = String(saved?.status || '').toUpperCase();
    const usage = String(saved?.usage || '').toUpperCase();
    const expected = usage === 'EVALUATION' ? 'APPROVED' : 'INDEXED';
    if (status !== expected) {
      const error = new Error(
        expected === 'INDEXED'
          ? 'Duyệt nạp RAG chưa ghi được vào tri thức. Bài vẫn đang chờ duyệt.'
          : 'Duyệt holdout chưa được lưu.',
      );
      error.userMessage = error.message;
      throw error;
    }
    return saved;
  },

  async reviewRubric(itemId, decision, payload) {
    return expertTrainingApi.reviewRubric(itemId, decision, payload);
  },

  async startEvaluation(payload) {
    return expertTrainingApi.startEvaluation(payload);
  },
};

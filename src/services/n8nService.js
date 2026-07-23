import {
  N8N_ASSIGNMENT_GRADING_TIMEOUT_MS,
  N8N_CHAT_TIMEOUT_MS,
  N8N_QUIZ_TIMEOUT_MS,
  N8N_TUTOR_V2_APPROVAL_TIMEOUT_MS,
  N8N_TUTOR_V2_EVALUATION_TIMEOUT_MS,
  N8N_TUTOR_V2_FLOW_TIMEOUT_MS,
  postN8n,
} from './n8nClient';
import {
  ensureHarnessSuccess,
  normalizeHarnessChatResponse,
  normalizeHarnessMode,
} from '../features/ai-harness/n8nResponse';

const normalizeN8nChatResponse = normalizeHarnessChatResponse;

export const n8nService = {
  async sendStudentChat(payload, options = {}) {
    const response = await postN8n('/student-chat', payload, {
      timeoutMs: N8N_CHAT_TIMEOUT_MS,
      ...options,
    });
    return normalizeN8nChatResponse(response, {
      conversationId: payload?.conversationId,
    });
  },

  async submitAnswerReview(payload, options = {}) {
    const response = await postN8n('/answer-review', {
      ...payload,
      mode: normalizeHarnessMode(payload?.mode),
    }, options);
    return ensureHarnessSuccess(response, 'Không thể hoàn tất luồng kiểm tra câu trả lời.');
  },

  async submitTeacherAnswer(payload, options = {}) {
    const response = await postN8n('/teacher-answer-escalation', payload, options);
    return ensureHarnessSuccess(response, 'Không thể hoàn tất luồng trả lời của giảng viên.');
  },

  async submitSeniorReviewResolution(payload, options = {}) {
    const response = await postN8n('/senior-resolve-answer-review', payload, options);
    return ensureHarnessSuccess(response, 'Không thể hoàn tất luồng kiểm duyệt cấp cao.');
  },

  async submitSeniorApproval(payload, options = {}) {
    const response = await postN8n('/senior-knowledge-approval', payload, options);
    return ensureHarnessSuccess(response, 'Không thể hoàn tất luồng phê duyệt tri thức.');
  },

  async generateQuiz(payload, options = {}) {
    const response = await postN8n('/quiz-generate', payload, {
      timeoutMs: N8N_QUIZ_TIMEOUT_MS,
      ...options,
    });
    return ensureHarnessSuccess(response, 'Không thể hoàn tất luồng tạo quiz.');
  },

  async submitQuiz(payload, options = {}) {
    const response = await postN8n('/quiz-submit', payload, {
      timeoutMs: N8N_QUIZ_TIMEOUT_MS,
      ...options,
    });
    return ensureHarnessSuccess(response, 'Không thể hoàn tất luồng nộp quiz.');
  },

  async gradeAssignmentSubmission(payload, options = {}) {
    const response = await postN8n('/teacher-assignment-ai-grade', payload, {
      timeoutMs: N8N_ASSIGNMENT_GRADING_TIMEOUT_MS,
      ...options,
    });
    const result = ensureHarnessSuccess(response, 'Không thể hoàn tất luồng AI hỗ trợ chấm bài.');
    if (!(result.id || result.submissionId) || !result.aiGradingStatus) {
      const error = new Error('n8n assignment grading returned an invalid receipt.');
      error.name = 'N8nError';
      error.userMessage = 'AI không trả về kết quả chấm đã xác nhận. Chưa có điểm cuối nào được lưu.';
      error.details = result;
      throw error;
    }
    return result;
  },

  async analyzeTutorV2Coverage(payload, options = {}) {
    return ensureHarnessSuccess(await postN8n('/v2-coverage-analyze', payload, {
      timeoutMs: N8N_TUTOR_V2_FLOW_TIMEOUT_MS,
      ...options,
      includeAuthTokenInBody: false,
    }), 'Không thể hoàn tất phân tích độ phủ Tutor V2.');
  },

  async submitTutorV2GoldQa(payload, options = {}) {
    return ensureHarnessSuccess(await postN8n('/v2-gold-qa-submit', payload, {
      timeoutMs: N8N_TUTOR_V2_FLOW_TIMEOUT_MS,
      ...options,
      includeAuthTokenInBody: false,
    }), 'Không thể hoàn tất luồng Gold Q&A của Tutor V2.');
  },

  async submitTutorV2Rubric(payload, options = {}) {
    return ensureHarnessSuccess(await postN8n('/v2-rubric-submit', payload, {
      timeoutMs: N8N_TUTOR_V2_FLOW_TIMEOUT_MS,
      ...options,
      includeAuthTokenInBody: false,
    }), 'Không thể hoàn tất luồng Rubric của Tutor V2.');
  },

  async approveTutorV2GoldQa(payload, options = {}) {
    return ensureHarnessSuccess(await postN8n('/v2-gold-qa-approve', payload, {
      timeoutMs: N8N_TUTOR_V2_APPROVAL_TIMEOUT_MS,
      ...options,
      includeAuthTokenInBody: false,
    }), 'Không thể phê duyệt Gold Q&A của Tutor V2.');
  },

  async approveTutorV2Rubric(payload, options = {}) {
    return ensureHarnessSuccess(await postN8n('/v2-rubric-approve', payload, {
      timeoutMs: N8N_TUTOR_V2_APPROVAL_TIMEOUT_MS,
      ...options,
      includeAuthTokenInBody: false,
    }), 'Không thể phê duyệt Rubric của Tutor V2.');
  },

  async runTutorV2Evaluation(payload, options = {}) {
    return ensureHarnessSuccess(await postN8n('/v2-eval-run', payload, {
      timeoutMs: N8N_TUTOR_V2_EVALUATION_TIMEOUT_MS,
      ...options,
      includeAuthTokenInBody: false,
    }), 'Không thể chạy Evaluation của Tutor V2.');
  },
};

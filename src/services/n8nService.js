import {
  N8N_ASSIGNMENT_GRADING_TIMEOUT_MS,
  N8N_CHAT_TIMEOUT_MS,
  N8N_QUIZ_TIMEOUT_MS,
  N8N_TUTOR_V2_TIMEOUT_MS,
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
    return ensureHarnessSuccess(response, 'n8n answer review flow failed.');
  },

  async submitTeacherAnswer(payload, options = {}) {
    const response = await postN8n('/teacher-answer-escalation', payload, options);
    return ensureHarnessSuccess(response, 'n8n teacher answer flow failed.');
  },

  async submitSeniorReviewResolution(payload, options = {}) {
    const response = await postN8n('/senior-resolve-answer-review', payload, options);
    return ensureHarnessSuccess(response, 'n8n senior review resolution flow failed.');
  },

  async submitSeniorApproval(payload, options = {}) {
    const response = await postN8n('/senior-knowledge-approval', payload, options);
    return ensureHarnessSuccess(response, 'n8n senior approval flow failed.');
  },

  async generateQuiz(payload, options = {}) {
    const response = await postN8n('/quiz-generate', payload, {
      timeoutMs: N8N_QUIZ_TIMEOUT_MS,
      ...options,
    });
    return ensureHarnessSuccess(response, 'n8n quiz generation flow failed.');
  },

  async submitQuiz(payload, options = {}) {
    const response = await postN8n('/quiz-submit', payload, {
      timeoutMs: N8N_QUIZ_TIMEOUT_MS,
      ...options,
    });
    return ensureHarnessSuccess(response, 'n8n quiz submission flow failed.');
  },

  async gradeAssignmentSubmission(payload, options = {}) {
    const response = await postN8n('/teacher-assignment-ai-grade', payload, {
      timeoutMs: N8N_ASSIGNMENT_GRADING_TIMEOUT_MS,
      ...options,
    });
    const result = ensureHarnessSuccess(response, 'n8n assignment grading flow failed.');
    if (!(result.id || result.submissionId) || !result.aiGradingStatus) {
      const error = new Error('n8n assignment grading returned an invalid receipt.');
      error.name = 'N8nError';
      error.userMessage = 'AI grading did not return a confirmed result. No final score was saved.';
      error.details = result;
      throw error;
    }
    return result;
  },

  async analyzeTutorV2Coverage(payload, options = {}) {
    return ensureHarnessSuccess(await postN8n('/v2-coverage-analyze', payload, {
      ...options,
      includeAuthTokenInBody: false,
    }), 'Tutor V2 coverage workflow failed.');
  },

  async submitTutorV2GoldQa(payload, options = {}) {
    return ensureHarnessSuccess(await postN8n('/v2-gold-qa-submit', payload, {
      ...options,
      includeAuthTokenInBody: false,
    }), 'Tutor V2 Gold Q&A workflow failed.');
  },

  async submitTutorV2Rubric(payload, options = {}) {
    return ensureHarnessSuccess(await postN8n('/v2-rubric-submit', payload, {
      ...options,
      includeAuthTokenInBody: false,
    }), 'Tutor V2 rubric workflow failed.');
  },

  async approveTutorV2GoldQa(payload, options = {}) {
    return ensureHarnessSuccess(await postN8n('/v2-gold-qa-approve', payload, {
      ...options,
      includeAuthTokenInBody: false,
    }), 'Tutor V2 Gold Q&A approval workflow failed.');
  },

  async approveTutorV2Rubric(payload, options = {}) {
    return ensureHarnessSuccess(await postN8n('/v2-rubric-approve', payload, {
      ...options,
      includeAuthTokenInBody: false,
    }), 'Tutor V2 rubric approval workflow failed.');
  },

  async runTutorV2Evaluation(payload, options = {}) {
    return ensureHarnessSuccess(await postN8n('/v2-eval-run', payload, {
      timeoutMs: N8N_TUTOR_V2_TIMEOUT_MS,
      ...options,
      includeAuthTokenInBody: false,
    }), 'Tutor V2 evaluation workflow failed.');
  },
};

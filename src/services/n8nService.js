import { createN8nError, postN8n } from './n8nClient';

const REVIEW_MODES = new Set(['RAG', 'CODE', 'ESCALATE']);

const normalizeMode = (mode) => {
  const value = String(mode || '').toUpperCase();
  if (value === 'RAG_TUTOR' || value === 'COURSE_AI') return 'RAG';
  if (value === 'CODE_MENTOR') return 'CODE';
  if (REVIEW_MODES.has(value)) return value;
  return value || 'RAG';
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.sources)) return value.sources;
  if (Array.isArray(value?.content)) return value.content;
  return [];
};

const ensureN8nSuccess = (response, fallbackMessage) => {
  if (!response || typeof response !== 'object') {
    throw createN8nError(fallbackMessage || 'AI workflow returned an invalid response.', {
      code: 'N8N_INVALID_RESPONSE',
      response,
    });
  }
  if (response.success === false || response.ok === false || response.status === 'FAILED') {
    throw createN8nError(fallbackMessage || 'AI workflow failed.', {
      code: 'N8N_FLOW_FAILED',
      rawMessage: response.message || response.error || null,
      response,
    });
  }
  return response;
};

export function normalizeN8nChatResponse(response = {}, fallbackContext = {}) {
  if (!response || typeof response !== 'object') {
    throw createN8nError('AI chat workflow returned an invalid response.', {
      code: 'N8N_CHAT_INVALID_RESPONSE',
      response,
    });
  }
  if (response.success === false || response.ok === false || response.status === 'FAILED') {
    throw createN8nError('AI chat workflow failed.', {
      code: 'N8N_CHAT_FLOW_FAILED',
      rawMessage: response.message || response.error || null,
      response,
    });
  }

  const mode = normalizeMode(response.mode);
  const escalated = Boolean(response.escalated || mode === 'ESCALATE');
  return {
    ...response,
    answer: response.answer || response.message || '',
    mode,
    confidence: response.confidence ?? (escalated ? 0 : null),
    sources: asArray(response.sources),
    conversationId: response.conversationId || response.sessionId || fallbackContext.conversationId || null,
    questionEscalationId: response.questionEscalationId || response.escalationId || null,
    escalated,
  };
}

export function normalizeReviewMode(mode) {
  return normalizeMode(mode);
}

export function isN8nUsableError(error) {
  return Boolean(error);
}

export const n8nService = {
  async sendStudentChat(payload) {
    const response = await postN8n('/student-chat', payload);
    return normalizeN8nChatResponse(response, {
      conversationId: payload?.conversationId,
    });
  },

  async submitAnswerReview(payload) {
    const response = await postN8n('/answer-review', {
      ...payload,
      mode: normalizeMode(payload?.mode),
    });
    return ensureN8nSuccess(response, 'n8n answer review flow failed.');
  },

  async submitTeacherAnswer(payload) {
    const response = await postN8n('/teacher-answer-escalation', payload);
    return ensureN8nSuccess(response, 'n8n teacher answer flow failed.');
  },

  async submitSeniorApproval(payload) {
    const response = await postN8n('/senior-knowledge-approval', payload);
    return ensureN8nSuccess(response, 'n8n senior approval flow failed.');
  }
};

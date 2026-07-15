import {
  createN8nError,
  N8N_CHAT_TIMEOUT_MS,
  N8N_QUIZ_TIMEOUT_MS,
  postN8n,
} from './n8nClient';

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

const unwrapResponse = (response) => {
  const root = Array.isArray(response) ? response[0] : response;
  if (root?.data && typeof root.data === 'object' && !Array.isArray(root.data)) {
    return { ...root, ...root.data };
  }
  return root;
};

const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const dedupeByIdentity = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = typeof item === 'string'
      ? item.trim().toLowerCase()
      : String(
          item?.materialId
          || item?.id
          || item?.url
          || item?.sourceUrl
          || item?.fileName
          || item?.filename
          || item?.title
          || JSON.stringify(item),
        ).trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeSuggestions = (value) => dedupeByIdentity(asArray(value));

const isFailedResponse = (response) => (
  response?.success === false
  || response?.ok === false
  || String(response?.status || '').toUpperCase() === 'FAILED'
);

const ensureN8nSuccess = (response, fallbackMessage) => {
  response = unwrapResponse(response);
  if (!response || typeof response !== 'object') {
    throw createN8nError(fallbackMessage || 'AI workflow returned an invalid response.', {
      code: 'N8N_INVALID_RESPONSE',
      response,
    });
  }
  if (isFailedResponse(response)) {
    throw createN8nError(fallbackMessage || 'AI workflow failed.', {
      code: 'N8N_FLOW_FAILED',
      rawMessage: response.message || response.error || null,
      response,
    });
  }
  return response;
};

export function normalizeN8nChatResponse(response = {}, fallbackContext = {}) {
  response = unwrapResponse(response);
  if (!response || typeof response !== 'object') {
    throw createN8nError('AI chat workflow returned an invalid response.', {
      code: 'N8N_CHAT_INVALID_RESPONSE',
      response,
    });
  }
  if (isFailedResponse(response)) {
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
    confidence: toNumberOrNull(response.confidence) ?? (escalated ? 0 : null),
    sources: dedupeByIdentity(asArray(response.sources)),
    conversationId: response.conversationId || response.sessionId || fallbackContext.conversationId || null,
    questionEscalationId: response.questionEscalationId || response.escalationId || null,
    userMessageId: response.userMessageId || response.studentMessageId || null,
    assistantMessageId: response.assistantMessageId || response.aiMessageId || response.messageId || null,
    nextImproveSuggestions: normalizeSuggestions(
      response.nextImproveSuggestions || response.improveSuggestions || response.suggestions,
    ),
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
      mode: normalizeMode(payload?.mode),
    }, options);
    return ensureN8nSuccess(response, 'n8n answer review flow failed.');
  },

  async submitTeacherAnswer(payload, options = {}) {
    const response = await postN8n('/teacher-answer-escalation', payload, options);
    return ensureN8nSuccess(response, 'n8n teacher answer flow failed.');
  },

  async submitSeniorReviewResolution(payload, options = {}) {
    const response = await postN8n('/senior-resolve-answer-review', payload, options);
    return ensureN8nSuccess(response, 'n8n senior review resolution flow failed.');
  },

  async submitSeniorApproval(payload, options = {}) {
    const response = await postN8n('/senior-knowledge-approval', payload, options);
    return ensureN8nSuccess(response, 'n8n senior approval flow failed.');
  },

  async generateQuiz(payload, options = {}) {
    const response = await postN8n('/quiz-generate', payload, {
      timeoutMs: N8N_QUIZ_TIMEOUT_MS,
      ...options,
    });
    return ensureN8nSuccess(response, 'n8n quiz generation flow failed.');
  },

  async submitQuiz(payload, options = {}) {
    const response = await postN8n('/quiz-submit', payload, {
      timeoutMs: N8N_QUIZ_TIMEOUT_MS,
      ...options,
    });
    return ensureN8nSuccess(response, 'n8n quiz submission flow failed.');
  },
};

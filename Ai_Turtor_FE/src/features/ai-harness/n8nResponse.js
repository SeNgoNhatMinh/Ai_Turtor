import { getAiMarkdownContent } from '../../utils/aiResponseContent.js';

const REVIEW_MODES = new Set(['RAG', 'CODE', 'ESCALATE']);

export function normalizeHarnessMode(mode) {
  const value = String(mode || '').toUpperCase();
  if (value === 'RAG_TUTOR' || value === 'COURSE_AI') return 'RAG';
  if (value === 'CODE_MENTOR') return 'CODE';
  if (REVIEW_MODES.has(value)) return value;
  return value || 'RAG';
}

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.sources)) return value.sources;
  if (Array.isArray(value?.content)) return value.content;
  return [];
};

const asNonEmptyId = (value) => {
  const id = typeof value === 'string' ? value.trim() : '';
  return id || '';
};

const isEphemeralHarnessId = (value) => (
  /^(conversation|session|trace)-\d{10,}$/i.test(String(value || '').trim())
);

const asPersistedConversationId = (value) => {
  const id = asNonEmptyId(value);
  return id && !isEphemeralHarnessId(id) ? id : '';
};

const parseJsonObject = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const unwrapResponse = (response) => {
  let root = parseJsonObject(Array.isArray(response) ? response[0] : response);
  let cursor = root;
  for (let depth = 0; depth < 4 && cursor && typeof cursor === 'object'; depth += 1) {
    const nested = cursor.data ?? cursor.body ?? cursor.json ?? cursor.output;
    const parsedNested = parseJsonObject(nested);
    if (!parsedNested || typeof parsedNested !== 'object' || Array.isArray(parsedNested)) break;
    root = { ...root, ...parsedNested };
    cursor = parsedNested;
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

const isFailedResponse = (response) => (
  response?.success === false
  || response?.ok === false
  || String(response?.status || '').toUpperCase() === 'FAILED'
);

function createHarnessResponseError(message, details = {}) {
  const error = new Error(message);
  error.name = 'N8nError';
  error.code = details.code || 'N8N_FLOW_FAILED';
  error.userMessage = message;
  error.rawMessage = details.rawMessage || null;
  error.details = details;
  return error;
}

export function ensureHarnessSuccess(response, fallbackMessage = 'Luồng AI thất bại.') {
  const normalized = unwrapResponse(response);
  if (!normalized || typeof normalized !== 'object') {
    throw createHarnessResponseError(fallbackMessage, {
      code: 'N8N_INVALID_RESPONSE',
      response: normalized,
    });
  }
  if (isFailedResponse(normalized)) {
    throw createHarnessResponseError(fallbackMessage, {
      code: 'N8N_FLOW_FAILED',
      rawMessage: normalized.message || normalized.error || null,
      response: normalized,
    });
  }
  return normalized;
}

export function normalizeHarnessChatResponse(response = {}, fallbackContext = {}) {
  const normalized = unwrapResponse(response);
  if (!normalized || typeof normalized !== 'object') {
    throw createHarnessResponseError('Luồng chat AI trả về dữ liệu không hợp lệ.', {
      code: 'N8N_CHAT_INVALID_RESPONSE',
      response: normalized,
    });
  }
  if (isFailedResponse(normalized)) {
    const quotaReached = normalized.code === 'DAILY_COURSE_QUESTION_LIMIT_REACHED';
    throw createHarnessResponseError(
      quotaReached
        ? normalized.message
        : 'Luồng chat AI thất bại.', {
      code: quotaReached ? normalized.code : 'N8N_CHAT_FLOW_FAILED',
      rawMessage: normalized.message || normalized.error || null,
      response: normalized,
    });
  }

  const mode = normalizeHarnessMode(normalized.mode);
  const escalated = Boolean(normalized.escalated || mode === 'ESCALATE');
  return {
    ...normalized,
    answer: getAiMarkdownContent(normalized),
    mode,
    confidence: toNumberOrNull(normalized.confidence) ?? (escalated ? 0 : null),
    sources: dedupeByIdentity(asArray(normalized.sources)),
    conversationId: asPersistedConversationId(normalized.conversationId)
      || asPersistedConversationId(normalized.conversation?.id)
      || asPersistedConversationId(fallbackContext.conversationId)
      || null,
    questionEscalationId: normalized.questionEscalationId || normalized.escalationId || null,
    userMessageId: normalized.userMessageId || normalized.studentMessageId || null,
    assistantMessageId: normalized.assistantMessageId
      || normalized.aiMessageId
      || normalized.messageId
      || null,
    nextImproveSuggestions: dedupeByIdentity(asArray(
      normalized.nextImproveSuggestions
      || normalized.improveSuggestions
      || normalized.suggestions,
    )),
    escalated,
  };
}

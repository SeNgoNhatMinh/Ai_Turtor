import { classIdMatches } from '../../../utils/academicIds.js';
import { extractAnswerSourceLabels, formatSourceItems } from '../../../utils/sourceLabels.js';

const normalizeComparableText = (value) => String(value || '')
  .normalize('NFC')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('vi');

const getEscalationId = (request) => (
  request?.id || request?.questionEscalationId || request?.escalationId || ''
);

export const findMentorRequestForMessage = ({
  requests = [],
  message,
  conversationId,
  courseId,
  classId,
}) => {
  const question = normalizeComparableText(message?.question);
  if (!question) return null;

  return requests.find((request) => {
    if (!getEscalationId(request)) return false;

    const requestQuestion = normalizeComparableText(
      request?.originalQuestion || request?.question || request?.questionPreview,
    );
    if (requestQuestion !== question) return false;

    const requestConversationId = String(request?.conversationId || '').trim();
    const currentConversationId = String(conversationId || message?.conversationId || '').trim();
    if (requestConversationId && requestConversationId !== currentConversationId) return false;

    const requestCourseId = String(request?.courseId || '').trim().toUpperCase();
    const currentCourseId = String(courseId || '').trim().toUpperCase();
    if (requestCourseId && currentCourseId && requestCourseId !== currentCourseId) return false;

    if (request?.classId && classId && !classIdMatches(request.classId, classId)) return false;
    return true;
  }) || null;
};

export const getMessageKey = (message, index) => {
  if (message?.id || message?.messageId || message?.requestId) {
    return String(message.id || message.messageId || message.requestId);
  }

  const question = String(message?.question || '').trim();
  const answer = String(message?.answer || '').trim();
  const stableContent = `${question.slice(0, 500)}|${answer.slice(0, 500)}`;
  if (!stableContent.trim()) return `message-${index}`;

  let hash = 0;
  for (let position = 0; position < stableContent.length; position += 1) {
    hash = ((hash << 5) - hash) + stableContent.charCodeAt(position);
    hash |= 0;
  }
  return `content-${Math.abs(hash).toString(36)}-${index}`;
};

export const getMessagePreview = (message) => {
  const text = String(message?.content || message?.question || message?.answer || '');
  return text.length > 82 ? `${text.slice(0, 82)}...` : text;
};

export const getPinTargetId = (message) => (
  message?.assistantMessageId
  || message?.aiMessageId
  || message?.responseMessageId
  || message?.messageId
  || message?.id
  || ''
);

const toSourceArray = (value) => {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
};

export const getCanonicalMessageSources = (message = {}, sourceMap = {}) => {
  const explicitSources = [
    ...toSourceArray(message.sources),
    ...toSourceArray(message.sourceMaterials),
    ...toSourceArray(message.materialSources),
    ...toSourceArray(message.sourceMaterialIds),
    ...toSourceArray(message.materialIds),
    ...toSourceArray(message.metadata?.sources),
  ];
  const persistedAnswerSources = extractAnswerSourceLabels(
    message.answer || message.response || message.content || '',
  );

  return formatSourceItems([...explicitSources, ...persistedAnswerSources], sourceMap);
};

const getPinnedMessageId = (message) => (
  message?.messageId
  || message?.id
  || message?._id
  || ''
);

export const normalizePinnedMessages = (data) => {
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.messages)
      ? data.messages
      : Array.isArray(data?.content)
        ? data.content
        : [];

  return list
    .map((item) => ({
      ...item,
      messageId: getPinnedMessageId(item),
      content: item?.content || item?.answer || item?.question || item?.message || '',
      role: item?.role || 'ASSISTANT',
      pinnedAt: item?.pinnedAt || item?.updatedAt || item?.createdAt || '',
    }))
    .filter((item) => item.messageId);
};

export const getLegacyPinnedStorageKey = (userId, sessionId) => (
  userId && sessionId ? `ai-tutor:pinned-chat-messages:${userId}:${sessionId}` : ''
);

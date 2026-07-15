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

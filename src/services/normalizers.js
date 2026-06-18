export const asArray = (data, ...keys) => {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
};

export const normalizeSession = (session) => ({
  ...session,
  id: session.id || session.conversationId,
  title: !session.title || session.title.includes('�') ? 'New conversation' : session.title,
  createdAt: session.createdAt || session.lastMessageAt || new Date().toISOString(),
});

export const normalizeMessage = (message) => ({
  ...message,
  question: message.question || message.userMessage || message.message || message.content || '',
  answer: message.answer || message.aiResponse || message.response || '',
});

export const normalizeEscalation = (escalation) => ({
  ...escalation,
  id: escalation.id || escalation.questionEscalationId,
  questionPreview: escalation.questionPreview || escalation.question || escalation.title || 'Support request',
  createdAt: escalation.createdAt || escalation.updatedAt || new Date().toISOString(),
  status: escalation.status || 'PENDING',
});

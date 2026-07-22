export const CONVERSATION_PAGE_SIZE = 50;
export const CHAT_TURN_LIMIT = 10;

const toFiniteNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

export function getSessionQuestionCount(session) {
  if (session?.userQuestionCount != null) {
    return Math.min(CHAT_TURN_LIMIT, Math.max(0, toFiniteNumber(session.userQuestionCount)));
  }
  if (session?.questionCount != null) {
    return Math.min(CHAT_TURN_LIMIT, Math.max(0, toFiniteNumber(session.questionCount)));
  }
  return Math.min(CHAT_TURN_LIMIT, Math.max(0, Math.floor(toFiniteNumber(session?.messageCount) / 2)));
}

function getSessionActivityDate(session) {
  const value = session?.lastMessageAt || session?.updatedAt || session?.createdAt;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

export function sortSessionsByActivity(items) {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => (
    getSessionActivityDate(b).getTime() - getSessionActivityDate(a).getTime()
  ));
}

const hasSessionChanged = (before, after) => (
  before?.lastMessageAt !== after?.lastMessageAt
  || before?.updatedAt !== after?.updatedAt
  || Number(before?.messageCount || 0) !== Number(after?.messageCount || 0)
  || getSessionQuestionCount(before) !== getSessionQuestionCount(after)
);

export function resolveCanonicalConversation({
  responseConversationId,
  previousSessionId,
  sessionsBefore = [],
  sessionsAfter = [],
}) {
  const before = Array.isArray(sessionsBefore) ? sessionsBefore : [];
  const after = sortSessionsByActivity(sessionsAfter);
  if (after.length === 0) return null;

  const directMatch = after.find((session) => session.id === responseConversationId);
  if (directMatch) return directMatch;

  const beforeById = new Map(before.map((session) => [session.id, session]));
  const newlyCreated = after.find((session) => !beforeById.has(session.id));
  if (newlyCreated) return newlyCreated;

  const updated = after.find((session) => {
    const previous = beforeById.get(session.id);
    return previous && hasSessionChanged(previous, session);
  });
  if (updated) return updated;

  if (previousSessionId && responseConversationId === previousSessionId) {
    return after.find((session) => session.id === previousSessionId) || null;
  }

  return null;
}

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getDayDiff = (date) => {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  return Math.floor((today.getTime() - target.getTime()) / 86400000);
};

const getTimeGroup = (session) => {
  const diff = getDayDiff(getSessionActivityDate(session));
  if (diff <= 0) return 'Hôm nay';
  if (diff === 1) return 'Hôm qua';
  if (diff <= 7) return '7 ngày trước';
  if (diff <= 30) return '30 ngày trước';
  return 'Cũ hơn';
};

export function formatSessionTime(session) {
  const date = getSessionActivityDate(session);
  if (!date.getTime()) return 'Chưa có tin nhắn';
  const diff = getDayDiff(date);
  if (diff <= 0) return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (diff === 1) return 'Hôm qua';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

export function groupSessionsByTime(sessions) {
  const groups = new Map();
  sortSessionsByActivity(sessions).forEach((session) => {
    const group = getTimeGroup(session);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(session);
  });
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

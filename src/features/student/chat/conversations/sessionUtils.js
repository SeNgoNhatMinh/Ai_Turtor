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

export function getSessionActivityDate(session) {
  const value = session?.lastMessageAt || session?.updatedAt || session?.createdAt;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

export function sortSessionsByActivity(items) {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => (
    getSessionActivityDate(b).getTime() - getSessionActivityDate(a).getTime()
  ));
}

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getDayDiff = (date) => {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  return Math.floor((today.getTime() - target.getTime()) / 86400000);
};

const getTimeGroup = (session) => {
  const diff = getDayDiff(getSessionActivityDate(session));
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff <= 7) return 'Previous 7 Days';
  if (diff <= 30) return 'Previous 30 Days';
  return 'Older';
};

export function formatSessionTime(session) {
  const date = getSessionActivityDate(session);
  if (!date.getTime()) return 'No messages yet';
  const diff = getDayDiff(date);
  if (diff <= 0) return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

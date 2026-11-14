const listeners = new Set();

let current = null;

function publish() {
  listeners.forEach((listener) => listener(current));
}

export function getActiveChatGeneration() {
  return current;
}

export function subscribeActiveChatGeneration(listener) {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

export function beginActiveChatGeneration(run) {
  current = {
    requestId: run.requestId,
    userId: run.userId || '',
    courseId: run.courseId || '',
    conversationId: run.conversationId || '',
    title: run.title || '',
    suggestionKey: run.suggestionKey || '',
    status: 'running',
    cancel: typeof run.cancel === 'function' ? run.cancel : null,
  };
  publish();
  return current;
}

export function rememberActiveChatConversation(requestId, { conversationId, title } = {}) {
  if (!current || current.requestId !== requestId) return current;
  current = {
    ...current,
    conversationId: conversationId || current.conversationId,
    title: title || current.title,
  };
  publish();
  return current;
}

export function completeActiveChatGeneration(requestId) {
  if (!current || current.requestId !== requestId || current.status === 'done') return current;
  current = { ...current, status: 'done', cancel: null };
  publish();
  return current;
}

export function acknowledgeActiveChatGeneration(requestId) {
  if (!current || current.requestId !== requestId || current.status !== 'done') return;
  current = null;
  publish();
}

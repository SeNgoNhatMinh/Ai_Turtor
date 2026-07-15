const HARNESS_SESSION_KEY = 'ai-tutor:harness-session-id';

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

export const createHarnessTraceId = () => createId();

export function getHarnessSessionId() {
  if (typeof window === 'undefined') return createId();
  const current = window.sessionStorage.getItem(HARNESS_SESSION_KEY);
  if (current) return current;
  const sessionId = createId();
  window.sessionStorage.setItem(HARNESS_SESSION_KEY, sessionId);
  return sessionId;
}

export function createHarnessEnvelope(payload = {}, authToken = '') {
  return {
    ...payload,
    traceId: payload.traceId || createHarnessTraceId(),
    sessionId: payload.sessionId || getHarnessSessionId(),
    ...(authToken ? { authToken } : {}),
  };
}

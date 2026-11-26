const HARNESS_SESSION_KEY = 'ai-tutor:harness-session-id';

// crypto.randomUUID only exists in secure contexts (HTTPS or localhost); the
// self-hosted LAN build is served over plain http://<server-ip>, so fall back to
// a v4 UUID from getRandomValues, which is available in every context.
export const createId = () => {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  if (typeof c?.getRandomValues === 'function') {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

export const createHarnessTraceId = () => createId();

function getHarnessSessionId() {
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

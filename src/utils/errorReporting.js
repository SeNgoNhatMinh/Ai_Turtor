const MAX_STORED_ERRORS = 20;
const ERROR_STORAGE_KEY = 'ai-tutor:frontend-errors';

export function createErrorReference() {
  const random = globalThis.crypto?.randomUUID?.().slice(0, 8)
    || Math.random().toString(36).slice(2, 10);
  return `FE-${Date.now().toString(36).toUpperCase()}-${random.toUpperCase()}`;
}

export function reportFrontendError(error, context = {}) {
  const reference = context.reference || createErrorReference();
  const record = {
    reference,
    name: error?.name || 'Error',
    message: error?.message || 'Unknown frontend error',
    route: typeof window !== 'undefined' ? window.location.pathname : '',
    occurredAt: new Date().toISOString(),
    ...context,
  };

  console.error('Frontend error', record, error);

  try {
    const stored = JSON.parse(window.sessionStorage.getItem(ERROR_STORAGE_KEY) || '[]');
    window.sessionStorage.setItem(
      ERROR_STORAGE_KEY,
      JSON.stringify([record, ...(Array.isArray(stored) ? stored : [])].slice(0, MAX_STORED_ERRORS)),
    );
  } catch {
    // Error reporting must never trigger another application error.
  }

  return reference;
}

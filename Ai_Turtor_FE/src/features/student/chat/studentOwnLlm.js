const STORAGE_PREFIX = 'ai-tutor:student-own-llm:';

export const STUDENT_LLM_PROVIDERS = [
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'groq', label: 'Groq' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'nvidia', label: 'NVIDIA' },
];

const storageKey = (userId) => `${STORAGE_PREFIX}${String(userId || '').trim()}`;

export function readStudentOwnLlm(userId) {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey(userId)) || 'null');
    if (!parsed?.provider || !parsed?.model || !parsed?.apiKey) return null;
    return {
      provider: String(parsed.provider),
      model: String(parsed.model),
      apiKey: String(parsed.apiKey),
    };
  } catch {
    return null;
  }
}

export function saveStudentOwnLlm(userId, value) {
  sessionStorage.setItem(storageKey(userId), JSON.stringify({
    provider: value.provider,
    model: value.model.trim(),
    apiKey: value.apiKey.trim(),
  }));
}

export function clearStudentOwnLlm(userId) {
  sessionStorage.removeItem(storageKey(userId));
}

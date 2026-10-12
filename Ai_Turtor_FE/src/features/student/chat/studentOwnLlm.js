const STORAGE_PREFIX = 'ai-tutor:student-own-llm:';

export const STUDENT_LLM_PROVIDERS = [
  { id: 'openrouter', label: 'OpenRouter', docsUrl: 'https://openrouter.ai/keys' },
  { id: 'groq', label: 'Groq', docsUrl: 'https://console.groq.com/keys' },
  { id: 'openai', label: 'OpenAI', docsUrl: 'https://platform.openai.com/api-keys' },
  { id: 'nvidia', label: 'NVIDIA', docsUrl: 'https://build.nvidia.com/' },
];

const storageKey = (userId) => `${STORAGE_PREFIX}${String(userId || '').trim()}`;

export function readStudentOwnLlm(userId) {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey(userId)) || 'null');
    if (!parsed?.provider || !parsed?.model) return null;
    if (!parsed.configured && !parsed.apiKey) return null;
    return {
      provider: String(parsed.provider),
      model: String(parsed.model),
      configured: Boolean(parsed.configured || parsed.apiKey),
      apiKey: parsed.apiKey ? String(parsed.apiKey) : '',
    };
  } catch {
    return null;
  }
}

export function saveStudentOwnLlm(userId, value) {
  sessionStorage.setItem(storageKey(userId), JSON.stringify({
    provider: value.provider,
    model: value.model.trim(),
    configured: true,
  }));
}

export function clearStudentOwnLlm(userId) {
  sessionStorage.removeItem(storageKey(userId));
}

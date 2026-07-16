export const readJsonStorage = (key, fallback = null) => {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const sanitizePersistedUser = (user) => {
  if (!user || typeof user !== 'object') return null;
  const safeUser = { ...user };
  delete safeUser.token;
  delete safeUser.password;
  return safeUser;
};

const getSuggestionsStorageKey = (studentId, courseId) => {
  if (!studentId || !courseId) return '';
  return `ai-tutor:analyzed-suggestions:${studentId}:${courseId}`;
};

export const readAnalyzedSuggestions = (studentId, courseId) => {
  const key = getSuggestionsStorageKey(studentId, courseId);
  if (!key) return [];
  try {
    const raw = window.localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(Boolean) : [];
  } catch {
    return [];
  }
};

export const writeAnalyzedSuggestions = (studentId, courseId, suggestions) => {
  const key = getSuggestionsStorageKey(studentId, courseId);
  if (!key) return;
  window.localStorage.setItem(key, JSON.stringify((suggestions || []).filter(Boolean)));
};

const getSuggestionTextValue = (suggestion) => (
  typeof suggestion === 'string'
    ? suggestion
    : suggestion?.title || suggestion?.content || ''
);

export const suggestionMatchesText = (suggestion, text) => (
  String(getSuggestionTextValue(suggestion)).trim().toLowerCase() === String(text || '').trim().toLowerCase()
);

export const createRecoveredSuggestion = (text) => ({
  priority: 'medium',
  title: text,
  content: 'Saved from pinned items. Keep reviewing this topic when you continue your study plan.',
});

export const mergeSuggestionLists = (...lists) => {
  const merged = [];
  const seen = new Set();
  lists.flat().filter(Boolean).forEach((suggestion) => {
    const key = String(getSuggestionTextValue(suggestion)).trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(suggestion);
  });
  return merged;
};

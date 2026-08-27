export const APP_SESSION_USER_KEY = 'ai-tutor:current-user';
export const APP_UI_STATE_KEY = 'ai-tutor:ui-state';
const APP_LAST_PATH_KEY = 'ai-tutor:last-path';

export const readJsonStorage = (key, fallback = null) => {
  try {
    const localRaw = window.localStorage.getItem(key);
    if (localRaw) return JSON.parse(localRaw);

    // Migrate older sessionStorage values so a new tab keeps the login.
    const sessionRaw = window.sessionStorage.getItem(key);
    if (sessionRaw) {
      window.localStorage.setItem(key, sessionRaw);
      window.sessionStorage.removeItem(key);
      return JSON.parse(sessionRaw);
    }
    return fallback;
  } catch {
    return fallback;
  }
};

export const writeJsonStorage = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore quota / private-mode write failures.
  }
};

export const removeJsonStorage = (key) => {
  try {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage access failures.
  }
};

export const readLastPath = () => {
  try {
    return String(window.localStorage.getItem(APP_LAST_PATH_KEY) || '').trim();
  } catch {
    return '';
  }
};

export const writeLastPath = (path) => {
  const safe = String(path || '').trim();
  if (!safe.startsWith('/') || safe.startsWith('//')) return;
  try {
    window.localStorage.setItem(APP_LAST_PATH_KEY, safe);
  } catch {
    // Ignore storage access failures.
  }
};

export const clearLastPath = () => {
  try {
    window.localStorage.removeItem(APP_LAST_PATH_KEY);
  } catch {
    // Ignore storage access failures.
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
    : suggestion?.actionText || suggestion?.title || suggestion?.content || ''
);

const normalizeSuggestionValue = (value) => String(value || '').trim().toLowerCase();

export const suggestionMatchesText = (suggestion, target) => {
  const targetDeleteValue = typeof target === 'object' ? target?.deleteValue : '';
  if (
    targetDeleteValue
    && suggestion?.deleteValue
    && normalizeSuggestionValue(suggestion.deleteValue) === normalizeSuggestionValue(targetDeleteValue)
  ) {
    return true;
  }

  const targetText = getSuggestionTextValue(target);
  const candidates = typeof suggestion === 'string'
    ? [suggestion]
    : [suggestion?.actionText, suggestion?.title, suggestion?.content];

  return candidates.some((candidate) => (
    normalizeSuggestionValue(candidate) === normalizeSuggestionValue(targetText)
  ));
};

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

import { useCallback, useMemo, useState } from 'react';

const STORAGE_PREFIX = 'ai-tutor:study-suggestion-progress:v2';
const MAX_LEARNED_SUGGESTIONS = 100;

const normalizeIdentity = (value) => String(value || '')
  .normalize('NFKC')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase();

export function getStudySuggestionText(suggestion) {
  return String(
    suggestion?.suggestionText
    || suggestion?.title
    || suggestion?.topic
    || suggestion?.content
    || suggestion?.text
    || suggestion
    || '',
  ).trim();
}

export function getStudySuggestionKey(suggestion) {
  const explicitKey = normalizeIdentity(
    suggestion?.studySuggestionKey
    || suggestion?.suggestionKey
    || suggestion?.key
    || suggestion?.chapterKey,
  );
  if (/^(?:key|text):/.test(explicitKey)) return explicitKey;
  if (explicitKey) return `key:${explicitKey}`;

  const text = normalizeIdentity(getStudySuggestionText(suggestion));
  return text ? `text:${text}` : '';
}

export function getStudySuggestionStorageKey(studentId, courseId) {
  const student = encodeURIComponent(normalizeIdentity(studentId) || 'anonymous');
  const course = encodeURIComponent(normalizeIdentity(courseId) || 'none');
  return `${STORAGE_PREFIX}:${student}:${course}`;
}

export function isSuccessfulStudySuggestionAnswer(message) {
  const mode = String(message?.mode || '').toUpperCase();
  const outcome = String(message?.outcome || '').toUpperCase();
  return Boolean(
    message?.studySuggestionKey
    && String(message?.answer || '').trim()
    && !message?.pending
    && !message?.canceled
    && !message?.aiServiceError
    && !message?.escalated
    && !message?.questionEscalationId
    && mode !== 'ESCALATE'
    && outcome !== 'NEEDS_MENTOR',
  );
}

function getStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function readLearnedStudySuggestions(studentId, courseId) {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const parsed = JSON.parse(storage.getItem(getStudySuggestionStorageKey(studentId, courseId)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        key: getStudySuggestionKey(item),
        text: getStudySuggestionText(item),
        learnedAt: String(item?.learnedAt || ''),
      }))
      .filter((item) => item.key && item.text)
      .slice(-MAX_LEARNED_SUGGESTIONS);
  } catch {
    return [];
  }
}

function persistLearnedStudySuggestions(storageKey, suggestions) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(storageKey, JSON.stringify(suggestions));
  } catch {
    // Keep the progress in React state when browser storage is unavailable.
  }
}

export function useStudySuggestionProgress({ studentId, courseId }) {
  const storageKey = useMemo(
    () => getStudySuggestionStorageKey(studentId, courseId),
    [courseId, studentId],
  );
  const [progressByStorageKey, setProgressByStorageKey] = useState({});
  const learnedSuggestions = progressByStorageKey[storageKey]
    || readLearnedStudySuggestions(studentId, courseId);

  const markSuggestionLearned = useCallback((suggestion) => {
    const entry = {
      key: getStudySuggestionKey(suggestion),
      text: getStudySuggestionText(suggestion),
      learnedAt: new Date().toISOString(),
    };
    if (!entry.key || !entry.text) return null;

    setProgressByStorageKey((current) => {
      const currentSuggestions = current[storageKey]
        || readLearnedStudySuggestions(studentId, courseId);
      const nextSuggestions = [
        ...currentSuggestions.filter((item) => item.key !== entry.key),
        entry,
      ].slice(-MAX_LEARNED_SUGGESTIONS);
      persistLearnedStudySuggestions(storageKey, nextSuggestions);
      return { ...current, [storageKey]: nextSuggestions };
    });
    return entry;
  }, [courseId, storageKey, studentId]);

  return {
    learnedSuggestions,
    learnedSuggestionKeys: learnedSuggestions.map((item) => item.key),
    latestLearnedSuggestion: learnedSuggestions.at(-1) || null,
    hasStartedLearning: learnedSuggestions.length > 0,
    markSuggestionLearned,
  };
}

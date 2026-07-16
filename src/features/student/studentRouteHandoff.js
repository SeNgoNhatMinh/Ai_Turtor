const STUDY_CHAT_HANDOFF_KEY = 'ai-tutor:student:study-chat-handoff';
const QUIZ_TOPIC_HANDOFF_KEY = 'ai-tutor:student:quiz-topic-handoff';

const read = (key) => {
  if (typeof window === 'undefined') return null;
  try {
    const rawValue = window.sessionStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
};

const remove = (key) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(key);
};

const write = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Navigation still succeeds when browser storage is unavailable.
  }
};

export const writeStudyChatHandoff = (value) => write(STUDY_CHAT_HANDOFF_KEY, value);

export const readStudyChatHandoff = () => read(STUDY_CHAT_HANDOFF_KEY);

export const clearStudyChatHandoff = () => remove(STUDY_CHAT_HANDOFF_KEY);

export const writeQuizTopicHandoff = (suggestionText) => write(QUIZ_TOPIC_HANDOFF_KEY, {
  suggestionText: String(suggestionText || '').trim(),
});

export const readQuizTopicHandoff = () => (
  read(QUIZ_TOPIC_HANDOFF_KEY)?.suggestionText || ''
);

export const clearQuizTopicHandoff = () => remove(QUIZ_TOPIC_HANDOFF_KEY);

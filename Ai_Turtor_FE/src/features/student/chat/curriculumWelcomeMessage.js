import { getStudySuggestionText } from '../learning/studySuggestionProgress';

const normalizeStudyText = (value) => String(value || '')
  .normalize('NFKC')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase();

export function hasStartedStudySuggestion(messages, learnedSuggestions = []) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  if (safeMessages.some((message) => Boolean(message?.studySuggestionKey))) return true;

  // Canonical history loaded after a refresh may not contain the temporary FE
  // key. Match the persisted question against this course's learned items so
  // the welcome does not reappear inside the already-started conversation.
  const learnedTexts = new Set(
    (Array.isArray(learnedSuggestions) ? learnedSuggestions : [])
      .map((suggestion) => normalizeStudyText(getStudySuggestionText(suggestion)))
      .filter(Boolean),
  );
  if (learnedTexts.size === 0) return false;

  return safeMessages.some((message) => learnedTexts.has(normalizeStudyText(
    message?.displayQuestion || message?.clickedSuggestion || message?.question,
  )));
}

export function withCurriculumWelcome(messages, {
  courseId,
  curriculumWelcome,
  isMessagesLoading = false,
} = {}) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const answer = String(curriculumWelcome || '').trim();
  const curriculumId = `curriculum-${courseId}`;
  const conversationMessages = safeMessages.filter((message) => message?.id !== curriculumId);

  if (!answer || isMessagesLoading) return safeMessages;

  return [{
    id: curriculumId,
    question: '',
    answer,
    proactive: true,
    mode: 'RAG',
  }, ...conversationMessages];
}

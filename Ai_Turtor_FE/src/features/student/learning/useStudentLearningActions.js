import { writeQuizTopicHandoff } from '../studentRouteHandoff';
import { buildStudySuggestionPrompt, isGuidedLessonPrompt } from './studySuggestionPrompt';

const getSuggestionText = (suggestion) => String(
  suggestion?.suggestionText
  || suggestion?.title
  || suggestion?.topic
  || suggestion?.content
  || suggestion?.text
  || suggestion
  || '',
).trim();

export function useStudentLearningActions({
  switchTab,
  setChatDraft,
  sendChatMessage,
  triggerToast,
}) {
  const handleStudySuggestion = (suggestion) => {
    const text = getSuggestionText(suggestion);
    if (!text) return;

    const prompt = buildStudySuggestionPrompt(text, suggestion);
    const hasImprovePlanProvenance = suggestion?.improvePlanId && suggestion?.planItemId;
    const sourceMaterialIds = Array.isArray(suggestion?.sourceMaterialIds)
      ? suggestion.sourceMaterialIds.filter(Boolean)
      : [];
    const sourceChunkIds = Array.isArray(suggestion?.sourceChunkIds)
      ? suggestion.sourceChunkIds.filter(Boolean)
      : [];
    const chapterKey = String(suggestion?.chapterKey || '').trim();
    const chapterTitle = String(suggestion?.chapterTitle || '').trim();
    const hasSourceProvenance = sourceMaterialIds.length > 0;
    const isGuidedLesson = isGuidedLessonPrompt(prompt);
    const requestContext = hasImprovePlanProvenance || hasSourceProvenance || isGuidedLesson
      ? {
        interactionType: hasImprovePlanProvenance
          ? 'IMPROVE_PLAN_REVIEW'
          : (suggestion?.interactionType
            || (isGuidedLesson ? 'GUIDED_LESSON' : 'SOURCE_BACKED_STUDY_TIP')),
        displayQuestion: text,
        improvePlanId: suggestion?.improvePlanId || '',
        planItemId: suggestion?.planItemId || '',
        sourceMaterialIds,
        sourceChunkIds,
        chapterKey,
        chapterTitle,
        clickedSuggestion: text,
      }
      : {};
    if (sendChatMessage) {
      sendChatMessage(prompt, requestContext);
      return;
    }
    if (setChatDraft) {
      setChatDraft(prompt);
      triggerToast?.('Đã đưa gợi ý vào khung chat. Bạn có thể chỉnh sửa trước khi gửi.');
    }
  };

  const handleCreateQuizFromSuggestion = (suggestionText) => {
    const text = String(suggestionText || '').trim();
    if (!text) return;
    writeQuizTopicHandoff(text);
    switchTab?.('student-quizzes');
  };

  return {
    handleStudySuggestion,
    handleCreateQuizFromSuggestion,
    consumedSuggestionKeys: [],
  };
}

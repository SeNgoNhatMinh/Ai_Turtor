import { writeQuizTopicHandoff } from '../studentRouteHandoff';
import { buildStudySuggestionPrompt, isGuidedLessonPrompt } from './studySuggestionPrompt';
import {
  getStudySuggestionKey,
  getStudySuggestionText,
} from './studySuggestionProgress';

export function useStudentLearningActions({
  switchTab,
  setChatDraft,
  sendChatMessage,
  triggerToast,
}) {
  const handleStudySuggestion = (suggestion) => {
    const text = getStudySuggestionText(suggestion);
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
    const studySuggestionKey = getStudySuggestionKey(suggestion);
    const studySuggestionContext = {
      displayQuestion: text,
      clickedSuggestion: text,
      studySuggestionKey,
    };
    const requestContext = hasImprovePlanProvenance || hasSourceProvenance || isGuidedLesson
      ? {
        ...studySuggestionContext,
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
      }
      : studySuggestionContext;
    if (sendChatMessage) {
      return sendChatMessage(prompt, requestContext);
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

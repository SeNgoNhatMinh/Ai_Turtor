import { writeQuizTopicHandoff } from '../studentRouteHandoff';
import { buildStudySuggestionPrompt } from './studySuggestionPrompt';

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

    const prompt = buildStudySuggestionPrompt(text);
    if (sendChatMessage) {
      sendChatMessage(prompt);
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

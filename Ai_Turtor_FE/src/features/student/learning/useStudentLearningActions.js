import { useEffect } from 'react';
import { writeQuizTopicHandoff, writeStudyChatHandoff } from '../studentRouteHandoff';
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
  activeTab,
  courseId,
  switchTab,
  loadStudentDashboard,
  setChatDraft,
  sendChatMessage,
  triggerToast,
}) {
  useEffect(() => {
    if (activeTab === 'student-memory') {
      loadStudentDashboard?.();
    }
    // Dashboard refresh is driven by tab/course changes, not callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, courseId]);

  const handleStudySuggestion = (suggestion) => {
    const text = getSuggestionText(suggestion);
    if (!text) return;

    const prompt = buildStudySuggestionPrompt(text);
    if (activeTab === 'student-chat' && sendChatMessage) {
      sendChatMessage(prompt);
      return;
    }
    if (activeTab === 'student-chat' && setChatDraft) {
      setChatDraft(prompt);
      triggerToast?.('Đã đưa gợi ý vào khung chat. Bạn có thể chỉnh sửa trước khi gửi.');
      return;
    }

    writeStudyChatHandoff({ suggestionText: text, prompt });
    switchTab?.('student-chat');
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

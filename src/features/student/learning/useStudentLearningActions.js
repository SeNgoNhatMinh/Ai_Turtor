import { useEffect } from 'react';
import { writeQuizTopicHandoff, writeStudyChatHandoff } from '../studentRouteHandoff';
import { buildStudySuggestionPrompt } from './studySuggestionPrompt';

export function useStudentLearningActions({
  activeTab,
  courseId,
  switchTab,
  loadStudentDashboard,
  setChatDraft,
  triggerToast,
}) {
  useEffect(() => {
    if (activeTab === 'student-memory') {
      loadStudentDashboard?.();
    }
    // Dashboard refresh is driven by tab/course changes, not callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, courseId]);

  const handleStudySuggestion = (suggestionText) => {
    const text = String(suggestionText || '').trim();
    if (!text) return;

    const prompt = buildStudySuggestionPrompt(text);
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

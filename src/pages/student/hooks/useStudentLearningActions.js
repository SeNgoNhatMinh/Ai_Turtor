import { useEffect, useState } from 'react';
import { getUserFacingError } from '../../../services/apiClient';
import { studentLearningApi } from '../../../services/studentLearningApi';

export function useStudentLearningActions({
  activeTab,
  userId,
  courseId,
  classId,
  activeSessionId,
  switchTab,
  loadStudentDashboard,
  openLearnedSuggestionResponse,
  sendText,
  triggerToast,
}) {
  const [quizInitialSuggestion, setQuizInitialSuggestion] = useState('');

  useEffect(() => {
    if (activeTab === 'student-memory') {
      loadStudentDashboard?.();
    }
    // Dashboard refresh is driven by tab/course changes, not callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, courseId]);

  const handleStudySuggestion = async (suggestionText) => {
    const text = String(suggestionText || '').trim();
    if (!text) return;

    const prompt = `Help me learn this topic step by step from the course materials: ${text}`;
    try {
      triggerToast?.('Preparing a guided study response...');
      const response = await studentLearningApi.learnSuggestion(userId, courseId, {
        classId,
        conversationId: activeSessionId || null,
        suggestionText: text,
        topic: text,
      });
      switchTab?.('student-chat');
      if (response?.conversationId || response?.answer) {
        await openLearnedSuggestionResponse?.(response, text);
        triggerToast?.('AI Tutor opened a guided study response for this suggestion.');
      } else {
        sendText(prompt);
      }
    } catch (error) {
      const isAlreadyUsed = error?.status === 409 || error?.details?.error === 'SUGGESTION_ALREADY_USED';
      if (isAlreadyUsed) {
        triggerToast?.('This suggestion was already used in course chat. Choose another suggestion or ask a new question.');
        switchTab?.('student-chat');
        return;
      }
      triggerToast?.(getUserFacingError(error, 'Unable to open this study suggestion. Using chat prompt instead.'));
      switchTab?.('student-chat');
      sendText(prompt);
    }
  };

  const handleCreateQuizFromSuggestion = (suggestionText) => {
    const text = String(suggestionText || '').trim();
    if (!text) return;
    setQuizInitialSuggestion(text);
    switchTab?.('student-quizzes');
  };

  return {
    quizInitialSuggestion,
    handleStudySuggestion,
    handleCreateQuizFromSuggestion,
  };
}

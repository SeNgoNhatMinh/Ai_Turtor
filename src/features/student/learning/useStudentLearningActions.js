import { useEffect } from 'react';
import { getUserFacingError } from '../../../services/apiClient';
import { studentLearningApi } from '../../../services/studentLearningApi';
import { useMutationLock } from '../../../hooks/useMutationLock';
import { writeQuizTopicHandoff, writeStudyChatHandoff } from '../studentRouteHandoff';

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
  const { runLocked } = useMutationLock();

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

    return runLocked(`suggestion:study:${text.toLowerCase()}`, async () => {
      const prompt = `Help me learn this topic step by step from the course materials: ${text}`;
      try {
        triggerToast?.('Preparing a guided study response...');
        const response = await studentLearningApi.learnSuggestion(userId, courseId, {
          classId,
          conversationId: activeSessionId || null,
          suggestionText: text,
          topic: text,
        });
        if (activeTab === 'student-chat' && (response?.conversationId || response?.answer)) {
          await openLearnedSuggestionResponse?.(response, text);
          triggerToast?.('AI Tutor opened a guided study response for this suggestion.');
        } else if (activeTab === 'student-chat') {
          sendText?.(prompt);
        } else {
          writeStudyChatHandoff({ response, suggestionText: text, prompt });
          switchTab?.('student-chat');
        }
      } catch (error) {
        const isAlreadyUsed = error?.status === 409 || error?.details?.error === 'SUGGESTION_ALREADY_USED';
        if (isAlreadyUsed) {
          triggerToast?.('This suggestion was already used in course chat. Choose another suggestion or ask a new question.');
          switchTab?.('student-chat');
          return;
        }
        triggerToast?.(getUserFacingError(error, 'Unable to open this study suggestion. Using chat prompt instead.'));
        if (activeTab === 'student-chat') {
          sendText?.(prompt);
        } else {
          writeStudyChatHandoff({ suggestionText: text, prompt });
          switchTab?.('student-chat');
        }
      }
    });
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
  };
}

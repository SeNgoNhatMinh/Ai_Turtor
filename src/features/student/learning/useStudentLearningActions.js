import { useEffect, useMemo, useState } from 'react';
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
  const storageKey = useMemo(
    () => `ai-tutor:consumed-suggestions:${userId || 'student'}:${courseId || 'course'}`,
    [courseId, userId],
  );
  const [consumedByScope, setConsumedByScope] = useState({});
  const consumedSuggestionKeys = useMemo(() => {
    if (consumedByScope[storageKey]) return consumedByScope[storageKey];
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(storageKey) || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }, [consumedByScope, storageKey]);

  const markSuggestionConsumed = (text) => {
    const key = String(text || '').trim().toLocaleLowerCase();
    if (!key) return;
    setConsumedByScope((current) => {
      const scopeItems = current[storageKey] || consumedSuggestionKeys;
      const next = scopeItems.includes(key) ? scopeItems : [...scopeItems, key];
      window.sessionStorage.setItem(storageKey, JSON.stringify(next));
      return { ...current, [storageKey]: next };
    });
  };

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
      const prompt = `Hãy hướng dẫn tôi học từng bước dựa trên tài liệu môn học về chủ đề: ${text}`;
      try {
        triggerToast?.('Đang chuẩn bị hướng dẫn học tập...');
        const response = await studentLearningApi.learnSuggestion(userId, courseId, {
          classId,
          conversationId: activeSessionId || null,
          suggestionText: text,
          topic: text,
        });
        markSuggestionConsumed(text);
        if (activeTab === 'student-chat' && (response?.conversationId || response?.answer)) {
          await openLearnedSuggestionResponse?.(response, text);
          triggerToast?.('AI Tutor đã mở hướng dẫn cho gợi ý này.');
        } else if (activeTab === 'student-chat') {
          sendText?.(prompt);
        } else {
          writeStudyChatHandoff({ response, suggestionText: text, prompt });
          switchTab?.('student-chat');
        }
      } catch (error) {
        const isAlreadyUsed = error?.status === 409 || error?.details?.error === 'SUGGESTION_ALREADY_USED';
        if (isAlreadyUsed) {
          markSuggestionConsumed(text);
          triggerToast?.('Gợi ý này đã được dùng trong chat môn học. Hãy chọn gợi ý khác hoặc đặt câu hỏi mới.');
          switchTab?.('student-chat');
          return;
        }
        triggerToast?.(getUserFacingError(error, 'Không thể mở gợi ý này. Hệ thống sẽ chuyển nội dung sang khung chat.'));
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
    consumedSuggestionKeys,
  };
}

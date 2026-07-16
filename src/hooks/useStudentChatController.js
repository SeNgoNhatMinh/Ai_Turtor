import { useEffect, useRef } from 'react';
import { aiTutorApi } from '../services/aiTutorApi';
import { conversationApi } from '../services/conversationApi';
import { getUserFacingError } from '../services/apiClient';
import { asArray, pairMessages } from '../services/normalizers';
import { N8N_ENABLED, N8N_STRICT } from '../services/n8nClient';
import { n8nService } from '../services/n8nService';
import {
  AI_SERVICE_ERROR_MESSAGE,
  buildAiServiceErrorMessage,
  isAiServiceErrorText,
} from '../utils/errorMessages';
import { hasBrokenTextEncoding, repairMojibake } from '../utils/textEncoding';
import { useConversationSessions } from '../features/student/chat/useConversationSessions';

const getSafeConversationTitle = (value, courseId) => {
  const repairedTitle = repairMojibake(value).trim();
  if (!repairedTitle || hasBrokenTextEncoding(repairedTitle)) {
    return courseId ? `AI Tutor - ${courseId}` : 'Cuộc trò chuyện mới';
  }
  return repairedTitle;
};

export function useStudentChatController({
  currentUser,
  studentId,
  courseId,
  classId,
  triggerToast,
  setCodeMentorDiagnostics,
}) {
  const conversation = useConversationSessions({
    currentUser,
    studentId,
    courseId,
    classId,
    triggerToast,
  });
  const {
    userId,
    activeSessionId,
    activeSessionTitle,
    sessions,
    messages,
    isSessionsLoading,
    turnLimitNotice,
    activeSessionQuestionCount,
    activeSessionMaxTurnsReached,
    setActiveSessionId,
    setActiveSessionTitle,
    setMessages,
    setTurnLimitNotice,
    bumpConversationActivity,
    dismissTurnLimitNotice,
    resetChat,
    loadChatSessions,
    handleSelectSession,
    handleCreateSession,
    handleDeleteSession,
    handleRenameSession,
  } = conversation;
  const activeAiRequestIdRef = useRef(0);
  const canceledAiRequestIdsRef = useRef(new Set());
  const activeAiAbortControllerRef = useRef(null);
  useEffect(() => () => {
    activeAiAbortControllerRef.current?.abort();
  }, []);

  const getStudentUserId = () => userId;

  const handleSendQuery = async (chatInput, codeSnippet, setAvatarEmotion) => {
    const text = chatInput.trim();
    const userId = getStudentUserId();
    if (!userId) {
      triggerToast('Vui lòng đăng nhập trước khi gửi tin nhắn.');
      return;
    }
    if (!courseId || !classId) {
      triggerToast('Tài khoản chưa được ghi danh vào lớp. Vui lòng liên hệ Admin hoặc giáo viên.');
      return;
    }
    const previousSessionId = activeSessionId;
    const previousSessionTitle = activeSessionTitle;
    const requestId = activeAiRequestIdRef.current + 1;
    activeAiRequestIdRef.current = requestId;
    activeAiAbortControllerRef.current?.abort();
    const requestController = new AbortController();
    activeAiAbortControllerRef.current = requestController;
    if (previousSessionId) {
      bumpConversationActivity({
        conversationId: previousSessionId,
        title: previousSessionTitle,
        messageCountIncrement: 1,
        questionCountIncrement: 1,
      });
    }
    setMessages((prev) => [...prev, { question: text, answer: null, pending: true, requestId }]);

    try {
      let data;
      if (N8N_ENABLED) {
        try {
          data = await n8nService.sendStudentChat({
            studentId: userId,
            studentName: currentUser?.fullName || '',
            studentEmail: currentUser?.email || '',
            courseId,
            classId,
            message: text,
            question: text,
            codeSnippet: codeSnippet || '',
            conversationId: previousSessionId || ''
          }, { signal: requestController.signal });
        } catch (n8nError) {
          if (requestController.signal.aborted) throw n8nError;
          if (N8N_STRICT) throw n8nError;
          console.warn('n8n request failed, trying backend API fallback:', n8nError);
          data = await aiTutorApi.sendQuery({
            question: text,
            message: text,
            codeSnippet: codeSnippet || null,
            courseId,
            classId,
            conversationId: previousSessionId || null
          }, userId, currentUser?.fullName || '', currentUser?.email || '', {
            signal: requestController.signal,
          });
        }
      } else {
        data = await aiTutorApi.sendQuery({
          question: text,
          message: text,
          codeSnippet: codeSnippet || null,
          courseId,
          classId,
          conversationId: previousSessionId || null
        }, userId, currentUser?.fullName || '', currentUser?.email || '', {
          signal: requestController.signal,
        });
      }

      const responseConversationId = data.conversationId || data.sessionId || previousSessionId;
      const responseConversationTitle = getSafeConversationTitle(
        data.conversationTitle || data.title || previousSessionTitle,
        courseId,
      );
      const didStartNewConversation = Boolean(previousSessionId && responseConversationId && responseConversationId !== previousSessionId);

      if (responseConversationId && responseConversationId !== previousSessionId) {
        setActiveSessionId(responseConversationId);
        setActiveSessionTitle(responseConversationTitle);
      }

      if (didStartNewConversation) {
        setTurnLimitNotice({
          type: 'turn-limit',
          previousSessionId,
          currentSessionId: responseConversationId,
          message: 'Cuộc trò chuyện đã đủ 10 câu hỏi. AI Tutor đã tạo cuộc trò chuyện mới để giữ ngữ cảnh tập trung.',
        });
      }

      bumpConversationActivity({
        conversationId: responseConversationId,
        title: responseConversationTitle,
        lastMessageAt: data.lastMessageAt || data.updatedAt || new Date().toISOString(),
        messageCountIncrement: responseConversationId === previousSessionId ? 0 : 1,
        questionCountIncrement: responseConversationId === previousSessionId ? 0 : 1,
        questionCount: data.userQuestionCount ?? data.questionCount,
        maxTurnsReached: data.maxTurnsReached,
      });

      if (canceledAiRequestIdsRef.current.has(requestId)) {
        canceledAiRequestIdsRef.current.delete(requestId);
        return;
      }

      setMessages((prev) => {
        const updated = [...prev];
        const answerText = String(data.answer || '');
        const isAiServiceError = isAiServiceErrorText(answerText);
        updated[updated.length - 1] = {
          question: text,
          answer: isAiServiceError ? AI_SERVICE_ERROR_MESSAGE : answerText,
          rawAnswer: answerText,
          id: data.assistantMessageId || data.messageId || data.aiMessageId || data.responseMessageId,
          messageId: data.assistantMessageId || data.messageId || data.aiMessageId || data.responseMessageId,
          assistantMessageId: data.assistantMessageId || data.messageId || data.aiMessageId || data.responseMessageId,
          userMessageId: data.userMessageId,
          conversationId: responseConversationId,
          mode: data.mode || 'RAG',
          confidence: data.confidence,
          sources: data.sources || [],
          nextImproveSuggestions: data.nextImproveSuggestions || [],
          questionEscalationId: data.questionEscalationId || data.escalationId || null,
          aiServiceError: isAiServiceError,
          retryable: isAiServiceError,
          pending: false
        };
        return updated;
      });

      if (didStartNewConversation) {
        try {
          const chatMsgs = await conversationApi.getMessages(responseConversationId, userId);
          const historyPairs = pairMessages(asArray(chatMsgs, 'content', 'messages'));
          if (historyPairs.length > 0) {
            setMessages(historyPairs);
          }
        } catch {
          // Keep the just-submitted exchange visible if history reload is not ready yet.
        }
      }

      if (data.mode === 'CODE' || data.mode === 'CODE_MENTOR') {
        setCodeMentorDiagnostics?.(data.answer);
        setAvatarEmotion('success');
      } else if (data.escalated || data.mode === 'ESCALATE') {
        setAvatarEmotion('idle');
      } else {
        setAvatarEmotion('success');
      }
    } catch (error) {
      if (canceledAiRequestIdsRef.current.has(requestId)) {
        canceledAiRequestIdsRef.current.delete(requestId);
        return;
      }

      setMessages((prev) => {
        const updated = [...prev];
        const friendlyError = getUserFacingError(error, 'AI Tutor chưa thể trả lời lúc này. Vui lòng thử lại sau.');
        const isAiServiceError = isAiServiceErrorText(friendlyError);
        updated[updated.length - 1] = {
          question: text,
          answer: buildAiServiceErrorMessage(friendlyError),
          rawAnswer: friendlyError,
          confidence: 0,
          sources: [],
          aiServiceError: isAiServiceError,
          retryable: true,
          pending: false
        };
        return updated;
      });
      setAvatarEmotion('idle');
      triggerToast(getUserFacingError(error, 'Yêu cầu AI Tutor thất bại. Vui lòng thử lại sau.'));
    } finally {
      if (activeAiAbortControllerRef.current === requestController) {
        activeAiAbortControllerRef.current = null;
      }
    }
  };

  const handleStopAiGeneration = () => {
    const requestId = activeAiRequestIdRef.current;
    if (requestId) canceledAiRequestIdsRef.current.add(requestId);
    activeAiAbortControllerRef.current?.abort();
    setMessages((prev) => {
      const updated = [...prev];
      let index = -1;
      for (let i = updated.length - 1; i >= 0; i -= 1) {
        if (updated[i]?.pending) {
          index = i;
          break;
        }
      }
      if (index >= 0) {
        updated[index] = {
          ...updated[index],
          answer: 'Đã dừng tạo câu trả lời. Bạn có thể chỉnh sửa câu hỏi hoặc thử nội dung khác.',
          pending: false,
          canceled: true,
        };
      }
      return updated;
    });
  };

  const openLearnedSuggestionResponse = async (data = {}, fallbackSuggestionText = '') => {
    const userId = getStudentUserId();
    if (!userId) {
      triggerToast('Vui lòng đăng nhập trước khi mở gợi ý học tập.');
      return;
    }

    const responseConversationId = data.conversationId || data.sessionId || activeSessionId;
    const responseConversationTitle = getSafeConversationTitle(
      data.conversationTitle || data.title || activeSessionTitle,
      courseId,
    );
    const clickedSuggestion = String(data.clickedSuggestion || fallbackSuggestionText || '').trim();
    const fallbackQuestion = clickedSuggestion
      ? `Gợi ý học tập: ${clickedSuggestion}`
      : 'Hãy hướng dẫn tôi học nội dung này từng bước.';
    const answerText = String(data.answer || '').trim();
    const isAiServiceError = isAiServiceErrorText(answerText);

    if (responseConversationId) {
      setActiveSessionId(responseConversationId);
      setActiveSessionTitle(responseConversationTitle);
      setTurnLimitNotice(null);
      bumpConversationActivity({
        conversationId: responseConversationId,
        title: responseConversationTitle,
        lastMessageAt: data.lastMessageAt || data.updatedAt || new Date().toISOString(),
        messageCountIncrement: 2,
        questionCountIncrement: 1,
        questionCount: data.userQuestionCount ?? data.questionCount,
        maxTurnsReached: data.maxTurnsReached,
      });
    }

    if (responseConversationId) {
      try {
        const chatMsgs = await conversationApi.getMessages(responseConversationId, userId);
        const historyPairs = pairMessages(asArray(chatMsgs, 'content', 'messages'));
        if (historyPairs.length > 0) {
          setMessages(historyPairs);
          await loadChatSessions();
          return;
        }
      } catch {
        // The backend already saved the turn. Keep the returned answer visible if history is not ready yet.
      }
    }

    setMessages([
      {
        question: fallbackQuestion,
        answer: isAiServiceError ? AI_SERVICE_ERROR_MESSAGE : answerText,
        rawAnswer: answerText,
        id: data.assistantMessageId || data.messageId || data.aiMessageId || data.responseMessageId,
        messageId: data.assistantMessageId || data.messageId || data.aiMessageId || data.responseMessageId,
        assistantMessageId: data.assistantMessageId || data.messageId || data.aiMessageId || data.responseMessageId,
        userMessageId: data.userMessageId,
        conversationId: responseConversationId,
        mode: data.mode || 'RAG',
        confidence: data.confidence,
        sources: data.sources || [],
        nextImproveSuggestions: data.nextImproveSuggestions || [],
        questionEscalationId: data.questionEscalationId || data.escalationId || null,
        clickedSuggestion,
        suggestionConsumed: data.suggestionConsumed,
        aiServiceError: isAiServiceError,
        retryable: isAiServiceError,
        pending: false,
      },
    ]);
    await loadChatSessions();
  };

  return {
    activeSessionId,
    activeSessionTitle,
    sessions,
    isSessionsLoading,
    messages,
    activeSessionQuestionCount,
    activeSessionMaxTurnsReached,
    turnLimitNotice,
    dismissTurnLimitNotice,
    resetChat,
    loadChatSessions,
    handleSelectSession,
    handleCreateSession,
    handleDeleteSession,
    handleRenameSession,
    handleSendQuery,
    handleStopAiGeneration,
    openLearnedSuggestionResponse,
  };
}

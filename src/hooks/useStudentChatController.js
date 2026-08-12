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
import {
  findCanonicalExchange,
  resolveCanonicalConversation,
} from '../features/student/chat/conversations/sessionUtils';
import { buildStudySuggestionPrompt } from '../features/student/learning/studySuggestionPrompt';

const getSafeConversationTitle = (value, courseId) => {
  const repairedTitle = repairMojibake(value).trim();
  if (!repairedTitle || hasBrokenTextEncoding(repairedTitle)) {
    return courseId ? `AI Tutor - ${courseId}` : 'Cuộc trò chuyện mới';
  }
  return repairedTitle;
};

const waitForConversationPersistence = () => new Promise((resolve) => {
  globalThis.setTimeout(resolve, 450);
});

const CANONICAL_ANSWER_RETRY_DELAYS = [0, 350, 800];

const recoverCanonicalAnswer = async ({ conversationId, userId, question, signal }) => {
  if (!conversationId || !userId) return null;

  for (const delayMs of CANONICAL_ANSWER_RETRY_DELAYS) {
    if (signal?.aborted) return null;
    if (delayMs > 0) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
    }
    if (signal?.aborted) return null;

    try {
      const chatMessages = await conversationApi.getMessages(conversationId, userId, { signal });
      const messagePairs = pairMessages(asArray(chatMessages, 'content', 'messages'));
      const exchange = findCanonicalExchange(messagePairs, question);
      if (exchange) return exchange;
    } catch (error) {
      if (signal?.aborted) return null;
      if (delayMs === CANONICAL_ANSWER_RETRY_DELAYS.at(-1)) throw error;
    }
  }

  return null;
};

const createMissingChatAnswerError = () => {
  const error = new Error('The AI workflow completed without a chat answer.');
  error.name = 'N8nError';
  error.code = 'N8N_CHAT_ANSWER_MISSING';
  error.userMessage = 'AI Tutor đã xử lý nhưng chưa đồng bộ được câu trả lời. Vui lòng thử lại.';
  return error;
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
    const sessionsBeforeRequest = Array.isArray(sessions) ? sessions : [];
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
      let refreshedSessions = await loadChatSessions();
      let canonicalSession = resolveCanonicalConversation({
        responseConversationId,
        previousSessionId,
        sessionsBefore: sessionsBeforeRequest,
        sessionsAfter: refreshedSessions,
      });

      if (!canonicalSession && responseConversationId) {
        await waitForConversationPersistence();
        refreshedSessions = await loadChatSessions();
        canonicalSession = resolveCanonicalConversation({
          responseConversationId,
          previousSessionId,
          sessionsBefore: sessionsBeforeRequest,
          sessionsAfter: refreshedSessions,
        });
      }

      const canonicalConversationId = canonicalSession?.id || responseConversationId;
      const canonicalConversationTitle = getSafeConversationTitle(
        canonicalSession?.title || responseConversationTitle,
        courseId,
      );
      const didStartNewConversation = Boolean(
        previousSessionId
        && canonicalConversationId
        && canonicalConversationId !== previousSessionId
      );

      if (!String(data.answer || '').trim() && canonicalConversationId) {
        const canonicalExchange = await recoverCanonicalAnswer({
          conversationId: canonicalConversationId,
          userId,
          question: text,
          signal: requestController.signal,
        });
        if (canonicalExchange) {
          data = {
            ...data,
            ...canonicalExchange,
            answer: canonicalExchange.answer,
            conversationId: canonicalConversationId,
          };
        }
      }

      if (!String(data.answer || '').trim()) {
        throw createMissingChatAnswerError();
      }

      if (canonicalConversationId && canonicalConversationId !== previousSessionId) {
        setActiveSessionId(canonicalConversationId);
        setActiveSessionTitle(canonicalConversationTitle);
      }

      if (didStartNewConversation) {
        setTurnLimitNotice({
          type: 'turn-limit',
          previousSessionId,
          currentSessionId: canonicalConversationId,
          message: 'Cuộc trò chuyện đã đủ 10 câu hỏi. AI Tutor đã tạo cuộc trò chuyện mới để giữ ngữ cảnh tập trung.',
        });
      }

      if (!canonicalSession) {
        bumpConversationActivity({
          conversationId: canonicalConversationId,
          title: canonicalConversationTitle,
          lastMessageAt: data.lastMessageAt || data.updatedAt || new Date().toISOString(),
          messageCountIncrement: canonicalConversationId === previousSessionId ? 0 : 1,
          questionCountIncrement: canonicalConversationId === previousSessionId ? 0 : 1,
          questionCount: data.userQuestionCount ?? data.questionCount,
          maxTurnsReached: data.maxTurnsReached,
        });
      }

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
          conversationId: canonicalConversationId,
          mode: data.mode || 'RAG',
          confidence: data.confidence,
          sources: data.sources || [],
          sourceEvidence: asArray(data.sourceEvidence),
          groundingType: data.groundingType || null,
          nextImproveSuggestions: data.nextImproveSuggestions || [],
          questionEscalationId: data.questionEscalationId || data.escalationId || null,
          aiServiceError: isAiServiceError,
          retryable: isAiServiceError,
          pending: false
        };
        return updated;
      });

      if (canonicalConversationId && (
        didStartNewConversation
        || canonicalConversationId !== responseConversationId
      )) {
        try {
          const chatMsgs = await conversationApi.getMessages(canonicalConversationId, userId);
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

  const openLearnedSuggestionResponse = async (
    data = {},
    fallbackSuggestionText = '',
    requestedQuestion = '',
  ) => {
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
    const fallbackQuestion = String(
      requestedQuestion
      || data.question
      || buildStudySuggestionPrompt(clickedSuggestion)
      || 'Hãy hướng dẫn em học nội dung này từng bước.',
    ).trim();
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
        const learnedExchange = findCanonicalExchange(historyPairs, fallbackQuestion);
        if (learnedExchange) {
          const learnedExchangeIndex = historyPairs.indexOf(learnedExchange);
          setMessages(historyPairs.map((item, index) => index === learnedExchangeIndex ? {
            ...item,
            mode: data.mode || item.mode,
            confidence: data.confidence ?? item.confidence,
            sources: data.sources || item.sources || [],
            sourceEvidence: data.sourceEvidence || item.sourceEvidence || [],
            groundingType: data.groundingType || item.groundingType || null,
            questionEscalationId: data.questionEscalationId || item.questionEscalationId || null,
          } : item));
          await loadChatSessions();
          return;
        }
      } catch {
        // The backend already saved the turn. Keep the returned answer visible if history is not ready yet.
      }
    }

    const learnedExchange = {
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
        sourceEvidence: data.sourceEvidence || [],
        groundingType: data.groundingType || null,
        nextImproveSuggestions: data.nextImproveSuggestions || [],
        questionEscalationId: data.questionEscalationId || data.escalationId || null,
        clickedSuggestion,
        suggestionConsumed: data.suggestionConsumed,
        aiServiceError: isAiServiceError,
        retryable: isAiServiceError,
        pending: false,
      };
    setMessages((currentMessages) => {
      const isCurrentConversation = Boolean(responseConversationId)
        && responseConversationId === activeSessionId;
      const messagesForConversation = isCurrentConversation ? currentMessages : [];
      const alreadyVisible = messagesForConversation.some((item) => (
        (
          Boolean(learnedExchange.userMessageId)
          && item?.userMessageId === learnedExchange.userMessageId
        )
        || (
          String(item?.question || '').trim() === fallbackQuestion
          && String(item?.answer || '').trim() === answerText
        )
      ));
      return alreadyVisible
        ? messagesForConversation
        : [...messagesForConversation, learnedExchange];
    });
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

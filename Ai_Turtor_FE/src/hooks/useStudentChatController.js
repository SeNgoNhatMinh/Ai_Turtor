import { useEffect, useRef } from 'react';
import { aiTutorApi } from '../services/aiTutorApi';
import { conversationApi } from '../services/conversationApi';
import { getUserFacingError } from '../services/apiClient';
import { asArray, pairMessages } from '../services/normalizers';
import { N8N_ENABLED, N8N_STRICT } from '../services/n8nClient';
import { n8nService } from '../services/n8nService';
import {
  buildAiServiceErrorMessage,
  isAiServiceErrorText,
} from '../utils/errorMessages';
import { hasBrokenTextEncoding, repairMojibake } from '../utils/textEncoding';
import { useConversationSessions } from '../features/student/chat/useConversationSessions';
import {
  DAILY_SESSION_COMPLETE_MESSAGE,
  isDailyCourseQuotaError,
} from '../constants/sessionQuota';
import { uiCopy } from '../constants/uiCopy';
import { resolveCanonicalConversation } from '../features/student/chat/conversations/sessionUtils';
import {
  createMissingChatAnswerError,
  isN8nTimeoutError,
  recoverCanonicalAnswer,
  recoverInFlightAnswer,
} from '../features/student/chat/chatAnswerRecovery';
import { useDailyQuestionQuota } from '../features/student/chat/useDailyQuestionQuota';
import { useTutorSessionController } from '../features/student/chat/useTutorSessionController';

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
    sessionMutationKey,
    isCreatingSession,
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
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const {
    dailyQuota,
    applyQuotaPayload,
    refreshDailyQuota,
    markDailyQuotaExhausted,
  } = useDailyQuestionQuota({ userId, studentId, courseId });
  const {
    activeTutorSession,
    tutorSessionSummary,
    isTutorSessionLoading,
    openTutorSession,
    closeTutorSessionIfDailyComplete,
    applyTutorResponse,
  } = useTutorSessionController({
    userId,
    courseId,
    classId,
    activeSessionId,
    triggerToast,
    setMessages,
    loadChatSessions,
    bumpConversationActivity,
    handleSelectSession,
  });

  useEffect(() => () => {
    activeAiAbortControllerRef.current?.abort();
  }, []);

  const getStudentUserId = () => userIdRef.current || userId;

  const handleSendQuery = async (chatInput, codeSnippet, setAvatarEmotion, requestContext = {}) => {
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
    setMessages((prev) => [...prev, {
      question: text,
      answer: null,
      pending: true,
      requestId,
      interactionType: requestContext.interactionType || '',
      displayQuestion: requestContext.displayQuestion || '',
    }]);

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
            conversationId: previousSessionId || '',
            tutorSessionId: activeTutorSession?.id || '',
            sessionPhase: activeTutorSession?.phase || 'TEACH',
            interactionType: requestContext.interactionType || '',
          }, { signal: requestController.signal });
        } catch (n8nError) {
          if (requestController.signal.aborted) throw n8nError;
          if (isDailyCourseQuotaError(n8nError)) throw n8nError;
          if (isN8nTimeoutError(n8nError)) {
            console.warn('n8n timed out; waiting for the in-flight answer instead of generating again');
            const recovered = await recoverInFlightAnswer({
              conversationId: previousSessionId || '',
              userId,
              question: text,
              signal: requestController.signal,
              loadSessions: (opts) => loadChatSessions(opts),
            });
            if (recovered) {
              data = recovered;
            } else {
              throw n8nError;
            }
          } else {
            if (N8N_STRICT) throw n8nError;
            console.warn('n8n request failed, trying backend API fallback:', n8nError);
            data = await aiTutorApi.sendQuery({
              question: text,
              message: text,
              codeSnippet: codeSnippet || null,
              courseId,
              classId,
              conversationId: previousSessionId || null,
              tutorSessionId: activeTutorSession?.id || null,
              sessionPhase: activeTutorSession?.phase || 'TEACH',
            }, userId, currentUser?.fullName || '', currentUser?.email || '', {
              signal: requestController.signal,
            });
          }
        }
      } else {
        data = await aiTutorApi.sendQuery({
          question: text,
          message: text,
          codeSnippet: codeSnippet || null,
          courseId,
          classId,
          conversationId: previousSessionId || null,
          tutorSessionId: activeTutorSession?.id || null,
          sessionPhase: activeTutorSession?.phase || 'TEACH',
        }, userId, currentUser?.fullName || '', currentUser?.email || '', {
          signal: requestController.signal,
        });
      }

      const responseConversationId = data.conversationId || previousSessionId;
      let nextQuota = applyQuotaPayload(data);
      if (!nextQuota) {
        try {
          nextQuota = await refreshDailyQuota();
        } catch {
          nextQuota = null;
        }
      }
      if (nextQuota && nextQuota.remaining <= 0) {
        await closeTutorSessionIfDailyComplete(0);
      } else {
        applyTutorResponse(data);
      }
      const responseConversationTitle = getSafeConversationTitle(
        data.conversationTitle || data.title || previousSessionTitle,
        courseId,
      );
      const staysInCurrentConversation = Boolean(
        previousSessionId
        && responseConversationId
        && responseConversationId === previousSessionId
        && !data.maxTurnsReached
      );
      let canonicalSession = staysInCurrentConversation
        ? sessionsBeforeRequest.find((session) => session.id === previousSessionId) || null
        : null;

      if (!staysInCurrentConversation) {
        let refreshedSessions = await loadChatSessions({ silent: true });
        canonicalSession = resolveCanonicalConversation({
          responseConversationId,
          previousSessionId,
          sessionsBefore: sessionsBeforeRequest,
          sessionsAfter: refreshedSessions,
        });

        if (!canonicalSession && responseConversationId) {
          await waitForConversationPersistence();
          refreshedSessions = await loadChatSessions({ silent: true });
          canonicalSession = resolveCanonicalConversation({
            responseConversationId,
            previousSessionId,
            sessionsBefore: sessionsBeforeRequest,
            sessionsAfter: refreshedSessions,
          });
        }
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

      if (didStartNewConversation && nextQuota?.remaining <= 0) {
        setTurnLimitNotice({
          type: 'turn-limit',
          previousSessionId,
          currentSessionId: canonicalConversationId,
          message: uiCopy.student.chat.rolloverMessage,
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
          interactionType: requestContext.interactionType || '',
          displayQuestion: requestContext.displayQuestion || '',
          answer: answerText,
          rawAnswer: answerText,
          understandingCheck: data.understandingCheck || null,
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
          pending: false,
          revealAnswer: !isAiServiceError,
        };
        return updated;
      });

      if (didStartNewConversation && canonicalConversationId) {
        try {
          const chatMsgs = await conversationApi.getMessages(canonicalConversationId, userId, {
            skipUnauthorizedRedirect: true,
          });
          const historyPairs = pairMessages(asArray(chatMsgs, 'content', 'messages'));
          if (historyPairs.length > 0) {
            setMessages((prev) => {
              const prevLast = prev[prev.length - 1];
              if (!prevLast?.revealAnswer) return historyPairs;
              const next = [...historyPairs];
              const last = next[next.length - 1];
              if (last && String(last.answer || '') === String(prevLast.answer || '')) {
                next[next.length - 1] = { ...last, revealAnswer: true };
              }
              return next;
            });
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

      const quotaReached = isDailyCourseQuotaError(error);
      if (quotaReached) {
        markDailyQuotaExhausted();
        await closeTutorSessionIfDailyComplete(0);
      }

      if (isDailyCourseQuotaError(error)) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            question: text,
            answer: DAILY_SESSION_COMPLETE_MESSAGE,
            rawAnswer: DAILY_SESSION_COMPLETE_MESSAGE,
            confidence: 1,
            sources: [],
            sessionComplete: true,
            aiServiceError: false,
            retryable: false,
            pending: false,
          };
          return updated;
        });
        setAvatarEmotion('idle');
        return;
      }

      setMessages((prev) => {
        const updated = [...prev];
        const friendlyError = getUserFacingError(error, 'Mình chưa soạn xong lượt này. Thử lại giúp mình nhé.');
        updated[updated.length - 1] = {
          question: text,
          answer: buildAiServiceErrorMessage(friendlyError),
          rawAnswer: friendlyError,
          confidence: 0,
          sources: [],
          aiServiceError: true,
          retryable: !quotaReached,
          pending: false
        };
        return updated;
      });
      setAvatarEmotion('idle');
      if (!quotaReached) {
        triggerToast(getUserFacingError(error, 'Mình chưa soạn xong lượt này. Thử lại giúp mình nhé.'));
        try {
          const nextQuota = await refreshDailyQuota();
          if (nextQuota?.remaining <= 0) {
            await closeTutorSessionIfDailyComplete(0);
          }
        } catch {
          // Keep the last known daily count if the quota endpoint is unavailable.
        }
      }
    } finally {
      if (activeAiAbortControllerRef.current === requestController) {
        activeAiAbortControllerRef.current = null;
      }
    }
  };

  const handleLockUnderstandingAnswer = async (message, selectedKey) => {
    const key = String(selectedKey || '').trim().toUpperCase();
    if (!/^[A-D]$/.test(key)) return;
    const conversationId = message?.conversationId || activeSessionId;
    const messageId = message?.assistantMessageId || message?.messageId || message?.id;
    const studentId = getStudentUserId();
    if (!conversationId || !messageId || !studentId) return;

    setMessages((prev) => prev.map((item) => {
      const itemId = item?.assistantMessageId || item?.messageId || item?.id;
      if (itemId !== messageId || item?.understandingSelectedKey) return item;
      return {
        ...item,
        understandingSelectedKey: key,
        understandingAnsweredAt: new Date().toISOString(),
      };
    }));

    try {
      await conversationApi.recordUnderstandingCheck(conversationId, messageId, studentId, key);
    } catch {
      // The attempt stays locked locally so the student cannot change it after a save failure.
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

  return {
    activeSessionId,
    activeSessionTitle,
    sessions,
    isSessionsLoading,
    sessionMutationKey,
    isCreatingSession,
    messages,
    activeSessionQuestionCount,
    activeSessionMaxTurnsReached,
    courseDailyQuota: dailyQuota,
    courseDailyQuotaExhausted: dailyQuota.remaining <= 0,
    turnLimitNotice,
    dismissTurnLimitNotice,
    resetChat,
    loadChatSessions,
    handleSelectSession,
    handleCreateSession,
    handleDeleteSession,
    handleRenameSession,
    handleSendQuery,
    handleLockUnderstandingAnswer,
    handleStopAiGeneration,
    activeTutorSession,
    tutorSessionSummary,
    isTutorSessionLoading,
    openTutorSession,
  };
}

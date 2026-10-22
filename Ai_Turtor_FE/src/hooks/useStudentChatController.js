import { useEffect, useRef } from 'react';
import { conversationApi } from '../services/conversationApi';
import { getUserFacingError } from '../services/apiClient';
import { asArray } from '../services/normalizers';
import { aiTutorApi } from '../services/aiTutorApi';
import { supportChatApi } from '../services/supportChatApi';
import { n8nService } from '../services/n8nService';
import { readStudentOwnLlm } from '../features/student/chat/studentOwnLlm';
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
import {
  createMissingChatAnswerError,
  isN8nTimeoutError,
  recoverCanonicalAnswer,
  recoverInFlightAnswer,
} from '../features/student/chat/chatAnswerRecovery';
import { useDailyQuestionQuota } from '../features/student/chat/useDailyQuestionQuota';
import { useTutorSessionController } from '../features/student/chat/useTutorSessionController';
import { isGuidedLessonPrompt } from '../features/student/learning/studySuggestionPrompt';

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
    sessionMutationKey,
    isCreatingSession,
    turnLimitNotice,
    activeSessionQuestionCount,
    activeSessionMaxTurnsReached,
    setActiveSessionId,
    setActiveSessionTitle,
    setMessages,
    setMessagesForConversation,
    getActiveSessionId,
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
  const activeRequestOriginRef = useRef(null);
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
    liveSupportLevel,
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
    const requestedMode = requestContext.requestedMode === 'CODE' ? 'CODE' : 'RAG';
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
    activeRequestOriginRef.current = { requestId, conversationId: previousSessionId || null };
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
      clientMessageId: `local-${requestId}`,
      interactionType: requestContext.interactionType || '',
      displayQuestion: requestContext.displayQuestion || '',
      requestedMode,
    }]);

    // The reply must land in the conversation where the question was asked
    // (previousSessionId), even if the student opens another conversation
    // while the AI is composing. Never write into the currently open one.
    const applyToTargetTurn = (transform) => {
      const apply = (list) => {
        const items = Array.isArray(list) ? [...list] : [];
        const index = items.findIndex((item) => (
          item?.requestId === requestId || item?.clientMessageId === `local-${requestId}`
        ));
        // The pending turn can vanish if the origin conversation refetches
        // from the server mid-flight; append the finished turn instead of
        // overwriting whatever exchange happens to be last.
        if (index < 0) return [...items, transform({})];
        items[index] = transform(items[index] || {});
        return items;
      };
      if (previousSessionId) {
        setMessagesForConversation(previousSessionId, apply);
      } else if (!getActiveSessionId()) {
        // Asked from the new-chat screen and the student is still there.
        setMessages(apply);
      }
      // Asked from the new-chat screen but the student has since opened
      // another conversation: write nothing anywhere. The answer is
      // persisted server-side and loads with its own conversation.
    };

    try {
      if (dailyQuota.remaining <= 0) {
        const ownLlm = readStudentOwnLlm(userId);
        if (!ownLlm) {
          applyToTargetTurn(() => ({
            question: text,
            answer: 'Hết 10 câu của hệ thống cho môn này. Gắn API LLM của bạn để học tiếp bằng tài liệu nhà trường.',
            rawAnswer: 'Hết 10 câu của hệ thống cho môn này. Gắn API LLM của bạn để học tiếp bằng tài liệu nhà trường.',
            confidence: 1,
            sources: [],
            pending: false,
            revealAnswer: true,
          }));
          setAvatarEmotion('idle');
          return;
        }
        const schoolAnswer = await aiTutorApi.answerFromSchoolMaterials({
          courseId,
          classId,
          question: text,
          provider: ownLlm.provider,
          model: ownLlm.model,
        }, ownLlm.apiKey, { signal: requestController.signal });
        if (canceledAiRequestIdsRef.current.has(requestId)) {
          canceledAiRequestIdsRef.current.delete(requestId);
          return;
        }
        const answerText = String(schoolAnswer?.answer || '');
        applyToTargetTurn((current) => ({
          ...current,
          question: text,
          answer: answerText,
          rawAnswer: answerText,
          confidence: schoolAnswer?.grounded ? 0.9 : 0,
          sources: schoolAnswer?.grounded ? ['Tài liệu nhà trường'] : [],
          pending: false,
          revealAnswer: true,
          personalLlm: true,
          nextImproveSuggestions: Array.isArray(schoolAnswer?.nextImproveSuggestions)
            ? schoolAnswer.nextImproveSuggestions
            : current.nextImproveSuggestions,
        }));
        setAvatarEmotion(schoolAnswer?.grounded ? 'success' : 'idle');
        return;
      }
      let data;
      const improvePlanPayload = requestContext.improvePlanId && requestContext.planItemId
        ? {
          improvePlanId: requestContext.improvePlanId,
          planItemId: requestContext.planItemId,
          clickedSuggestion: requestContext.clickedSuggestion || requestContext.displayQuestion || text,
        }
        : {};
      const sourceProvenancePayload = Array.isArray(requestContext.sourceMaterialIds)
        && requestContext.sourceMaterialIds.length > 0
        ? {
          interactionType: requestContext.interactionType || 'SOURCE_BACKED_STUDY_TIP',
          sourceMaterialIds: requestContext.sourceMaterialIds,
          sourceChunkIds: Array.isArray(requestContext.sourceChunkIds)
            ? requestContext.sourceChunkIds
            : [],
          clickedSuggestion: requestContext.clickedSuggestion || requestContext.displayQuestion || text,
        }
        : {};
      const guidedLesson = requestContext.interactionType === 'GUIDED_LESSON'
        || isGuidedLessonPrompt(text);
      const effectiveInteractionType = requestContext.interactionType
        || (guidedLesson ? 'GUIDED_LESSON' : '');
      const interactionPayload = effectiveInteractionType
        ? {
          interactionType: effectiveInteractionType,
          clickedSuggestion: requestContext.clickedSuggestion || requestContext.displayQuestion || text,
        }
        : {};
      const remediationPayload = effectiveInteractionType === 'UNDERSTANDING_REMEDIATION'
        ? {
          originAssistantMessageId: requestContext.originAssistantMessageId || '',
          understandingAttemptId: requestContext.understandingAttemptId || '',
          originalQuestion: requestContext.originalQuestion || requestContext.displayQuestion || '',
        }
        : {};
      const lessonProvenancePayload = requestContext.interactionType === 'GUIDED_LESSON'
        ? {
          chapterKey: requestContext.chapterKey || '',
          chapterTitle: requestContext.chapterTitle || '',
        }
        : {};
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
          requestedMode,
          conversationId: previousSessionId || '',
          tutorSessionId: activeTutorSession?.id || '',
          sessionPhase: activeTutorSession?.phase || 'TEACH',
          ...improvePlanPayload,
          ...interactionPayload,
          ...remediationPayload,
          ...sourceProvenancePayload,
          ...lessonProvenancePayload,
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
          // Harness is mandatory. Do not create a second, untraced backend RAG
          // request when n8n fails because that loses workflow context and can
          // duplicate the student's quota/conversation turn.
          throw n8nError;
        }
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
      // No canonical guessing: the reply is completed in the conversation
      // where the question was asked (previousSessionId), whatever id the
      // backend reports back. Only a question sent with no conversation yet
      // adopts the conversation the backend created for it.
      const displayConversationId = previousSessionId || responseConversationId;
      const displayConversationTitle = getSafeConversationTitle(
        responseConversationTitle,
        courseId,
      );

      if (!String(data.answer || '').trim() && responseConversationId) {
        const canonicalExchange = await recoverCanonicalAnswer({
          conversationId: responseConversationId,
          userId,
          question: text,
          signal: requestController.signal,
        });
        if (canonicalExchange) {
          data = {
            ...data,
            ...canonicalExchange,
            answer: canonicalExchange.answer,
            conversationId: responseConversationId,
          };
        }
      }

      if (!String(data.answer || '').trim()) {
        throw createMissingChatAnswerError();
      }

      if (canceledAiRequestIdsRef.current.has(requestId)) {
        canceledAiRequestIdsRef.current.delete(requestId);
        return;
      }

      // Adopt the backend-created conversation only if the student is
      // still on the new-chat screen; never yank them out of a
      // conversation they opened while waiting.
      if (!previousSessionId && responseConversationId && !getActiveSessionId()) {
        setActiveSessionId(responseConversationId);
        setActiveSessionTitle(displayConversationTitle);
      }

      bumpConversationActivity({
        conversationId: displayConversationId,
        title: displayConversationTitle,
        lastMessageAt: data.lastMessageAt || data.updatedAt || new Date().toISOString(),
        messageCountIncrement: 0,
        questionCountIncrement: 0,
        questionCount: data.userQuestionCount ?? data.questionCount,
        maxTurnsReached: data.maxTurnsReached,
      });

      const answerText = String(data.answer || '');
      const outcome = String(data.outcome || '').toUpperCase();
      const isAiServiceError = outcome === 'AI_UNAVAILABLE' || isAiServiceErrorText(answerText);
      const finalTurn = {
        question: text,
        interactionType: requestContext.interactionType || '',
        displayQuestion: requestContext.displayQuestion || '',
        requestedMode,
        answer: answerText,
        rawAnswer: answerText,
        understandingCheck: data.understandingCheck || null,
        id: data.assistantMessageId || data.messageId || data.aiMessageId || data.responseMessageId,
        messageId: data.assistantMessageId || data.messageId || data.aiMessageId || data.responseMessageId,
        assistantMessageId: data.assistantMessageId || data.messageId || data.aiMessageId || data.responseMessageId,
        userMessageId: data.userMessageId,
        conversationId: displayConversationId,
        mode: data.mode || 'RAG',
        confidence: data.confidence,
        sources: data.sources || [],
        sourceEvidence: asArray(data.sourceEvidence),
        groundingType: data.groundingType || null,
        nextImproveSuggestions: Array.isArray(data.nextImproveSuggestions)
          ? data.nextImproveSuggestions
          : undefined,
        questionEscalationId: data.questionEscalationId || data.escalationId || null,
        outcome: outcome || (data.escalated ? 'NEEDS_MENTOR' : 'ANSWERED'),
        aiServiceError: isAiServiceError,
        retryable: isAiServiceError,
        pending: false,
        revealAnswer: !isAiServiceError,
      };

      applyToTargetTurn(() => finalTurn);

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
      let timeoutEscalation = null;
      if (isN8nTimeoutError(error) && userId && courseId && classId) {
        try {
          timeoutEscalation = await supportChatApi.createEscalation({
            studentId: userId,
            studentName: currentUser?.fullName || currentUser?.name || '',
            studentEmail: currentUser?.email || '',
            courseId,
            classId,
            conversationId: previousSessionId || '',
            question: text,
            aiResponse: 'AI Tutor bị timeout khi xử lý câu hỏi; chưa có câu trả lời hoàn chỉnh.',
            reason: 'AI Tutor timeout khi xử lý yêu cầu học tập. Cần giảng viên xem xét và hỗ trợ sinh viên.',
          });
        } catch (escalationError) {
          console.warn('Could not escalate AI Tutor timeout to teacher:', escalationError);
        }
      }
      if (quotaReached) {
        markDailyQuotaExhausted();
        await closeTutorSessionIfDailyComplete(0);
      }

      if (isDailyCourseQuotaError(error)) {
        applyToTargetTurn(() => ({
          question: text,
          answer: DAILY_SESSION_COMPLETE_MESSAGE,
          rawAnswer: DAILY_SESSION_COMPLETE_MESSAGE,
          confidence: 1,
          sources: [],
          sessionComplete: true,
          aiServiceError: false,
          retryable: false,
          pending: false,
        }));
        setAvatarEmotion('idle');
        return;
      }

      const friendlyError = getUserFacingError(error, 'Mình chưa soạn xong lượt này. Thử lại giúp mình nhé.');
      applyToTargetTurn(() => ({
        question: text,
        answer: buildAiServiceErrorMessage(friendlyError),
        rawAnswer: friendlyError,
        confidence: 0,
        sources: [],
        aiServiceError: true,
        retryable: !quotaReached,
        questionEscalationId: timeoutEscalation?.questionEscalationId
          || timeoutEscalation?.id
          || timeoutEscalation?.escalationId
          || null,
        pending: false
      }));
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

  const handleLockUnderstandingAnswer = async (message, selectedKey, attempt = {}) => {
    const key = String(selectedKey || '').trim().toUpperCase();
    if (!/^[A-D]$/.test(key)) return;
    const conversationId = message?.conversationId || activeSessionId;
    const messageId = message?.assistantMessageId || message?.messageId || message?.id;
    const studentId = getStudentUserId();
    const quiz = attempt?.quiz || {};
    const quizIndex = Number.isInteger(attempt?.quizIndex) ? attempt.quizIndex : 0;
    const localGrade = () => {
      const correctKey = String(quiz.correctKey || '').trim().toUpperCase();
      if (!correctKey) return null;
      return {
        correct: key === correctKey,
        correctKey,
        explanation: quiz.explanation || '',
        messageId: messageId || '',
        attemptId: '',
      };
    };
    const markSelected = () => {
      setMessages((prev) => prev.map((item) => {
        const itemId = item?.assistantMessageId || item?.messageId || item?.id;
        const sameSaved = messageId && itemId === messageId;
        const sameLocal = message?.clientMessageId && item?.clientMessageId === message.clientMessageId;
        if (!sameSaved && !sameLocal) return item;
        const attempts = Array.isArray(item?.understandingCheckAttempts)
          ? [...item.understandingCheckAttempts] : [];
        const position = attempts.findIndex((entry) => Number(entry?.quizIndex ?? -1) === quizIndex);
        if (position >= 0 && attempts[position]?.selectedKey) return item;
        if (quizIndex === 0 && item?.understandingSelectedKey) return item;
        const entry = {
          quizIndex,
          selectedKey: key,
          answeredAt: new Date().toISOString(),
        };
        if (position >= 0) attempts[position] = { ...attempts[position], ...entry };
        else attempts.push(entry);
        return {
          ...item,
          understandingCheckAttempts: attempts,
          ...(quizIndex === 0 ? {
            understandingSelectedKey: key,
            understandingAnsweredAt: entry.answeredAt,
          } : {}),
        };
      }));
    };
    if (!conversationId || !messageId || !studentId || message?.personalLlm) {
      markSelected();
      return localGrade();
    }

    markSelected();

    try {
      const result = await conversationApi.recordUnderstandingCheck(
        conversationId,
        messageId,
        studentId,
        key,
        quizIndex,
      );
      setMessages((prev) => prev.map((item) => {
        const itemId = item?.assistantMessageId || item?.messageId || item?.id;
        if (itemId !== messageId) return item;
        const attempts = (Array.isArray(item?.understandingCheckAttempts)
          ? item.understandingCheckAttempts : [])
          .map((entry) => (Number(entry?.quizIndex ?? -1) === quizIndex
            ? { ...entry, correct: result?.correct, attemptId: result?.attemptId || entry.attemptId || '' }
            : entry));
        return {
          ...item,
          understandingCheckAttempts: attempts,
          ...(quizIndex === 0 ? {
            understandingAttemptId: result?.attemptId || item.understandingAttemptId || '',
            understandingCorrect: result?.correct,
          } : {}),
        };
      }));
      return result;
    } catch {
      markSelected();
      return localGrade();
    }
  };

  const handleStopAiGeneration = () => {
    const requestId = activeAiRequestIdRef.current;
    if (requestId) canceledAiRequestIdsRef.current.add(requestId);
    activeAiAbortControllerRef.current?.abort();
    // Mark the canceled turn in the conversation it belongs to, which is
    // not necessarily the one currently on screen.
    const origin = activeRequestOriginRef.current;
    const markCanceled = (prev) => {
      const updated = [...(Array.isArray(prev) ? prev : [])];
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
    };
    if (origin?.requestId === requestId && origin.conversationId) {
      setMessagesForConversation(origin.conversationId, markCanceled);
    } else {
      setMessages(markCanceled);
    }
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
    studentSupportLevel: liveSupportLevel,
    tutorSessionSummary,
    isTutorSessionLoading,
    openTutorSession,
  };
}

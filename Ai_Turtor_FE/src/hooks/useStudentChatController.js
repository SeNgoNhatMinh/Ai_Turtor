import { useEffect, useRef, useState } from 'react';
import { aiTutorApi } from '../services/aiTutorApi';
import { conversationApi } from '../services/conversationApi';
import { getUserFacingError } from '../services/apiClient';
import { asArray, pairMessages } from '../services/normalizers';
import { N8N_ENABLED, N8N_STRICT } from '../services/n8nClient';
import { n8nService } from '../services/n8nService';
import { tutorSessionApi } from '../services/tutorSessionApi';
import { useRealtimeEvent, useRealtimeReconnect } from '../features/realtime/realtimeContext';
import { REALTIME_EVENT_TYPES } from '../features/realtime/realtimeEvents';
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

const openingContent = (openingMessage) => String(openingMessage?.content || '').trim();

const toOpeningTurn = (openingMessage) => {
  const content = openingContent(openingMessage);
  if (!content) return null;
  return {
    id: openingMessage?.messageId || openingMessage?.id || `opening-${content.slice(0, 24)}`,
    question: '',
    answer: content,
    proactive: true,
    mode: 'TUTOR',
  };
};

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
      const chatMessages = await conversationApi.getMessages(conversationId, userId, {
        signal,
        skipUnauthorizedRedirect: true,
      });
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
  const [activeTutorSession, setActiveTutorSession] = useState(null);
  const [tutorSessionSummary, setTutorSessionSummary] = useState(null);
  const [isTutorSessionLoading, setIsTutorSessionLoading] = useState(false);
  const canceledAiRequestIdsRef = useRef(new Set());
  const activeAiAbortControllerRef = useRef(null);
  const tutorOpenInFlightRef = useRef(false);
  const activeSessionIdRef = useRef(activeSessionId);
  const courseIdRef = useRef(courseId);
  const userIdRef = useRef(userId);
  const classIdRef = useRef(classId);
  activeSessionIdRef.current = activeSessionId;
  courseIdRef.current = courseId;
  userIdRef.current = userId;
  classIdRef.current = classId;
  useEffect(() => () => {
    activeAiAbortControllerRef.current?.abort();
  }, []);

  const getStudentUserId = () => userIdRef.current || userId;

  const seedOpeningMessage = (openingMessage) => {
    const turn = toOpeningTurn(openingMessage);
    if (!turn) return;
    setMessages((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const welcomeIndex = list.findIndex((item) => (
        item?.id === turn.id
        || String(item?.answer || '').trim() === turn.answer
        || (!String(item?.question || '').trim() && /chào mừng bạn đến với buổi học/i.test(String(item?.answer || '')))
      ));
      if (welcomeIndex >= 0) {
        const next = [...list];
        next[welcomeIndex] = { ...next[welcomeIndex], ...turn, id: next[welcomeIndex].id || turn.id };
        return next;
      }
      return [turn, ...list];
    });
  };

  const mergeTutorSession = (session) => {
    if (!session?.id) return;
    setActiveTutorSession((current) => (
      current?.id && current.id !== session.id
        ? { ...session }
        : { ...(current || {}), ...session }
    ));
  };

  const openTutorSession = async () => {
    if (!userId || !courseId || !classId || isTutorSessionLoading || tutorOpenInFlightRef.current) return null;
    tutorOpenInFlightRef.current = true;
    setIsTutorSessionLoading(true);
    try {
      const data = await tutorSessionApi.openSession({
        studentId: userId,
        courseId,
        classId,
      });
      const session = data?.session || null;
      mergeTutorSession(session);
      setTutorSessionSummary(null);
      const conversationId = data?.conversationId;
      await loadChatSessions({ silent: true });
      if (conversationId) {
        bumpConversationActivity({
          conversationId,
          title: 'Buổi học cùng AI Tutor',
          messageCountIncrement: openingContent(data?.openingMessage) ? 1 : 0,
        });
        await handleSelectSession(conversationId, 'Buổi học cùng AI Tutor', { silent: true });
        seedOpeningMessage(data?.openingMessage);
      }
      return data;
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể mở buổi học cùng AI Tutor.'));
      return null;
    } finally {
      tutorOpenInFlightRef.current = false;
      setIsTutorSessionLoading(false);
    }
  };

  useRealtimeEvent(REALTIME_EVENT_TYPES.tutorSession, (event) => {
    const payload = event?.data || {};
    const session = payload.session;
    if (!session?.id) return;
    if (String(session.courseId || payload.courseId || '') !== String(courseIdRef.current || '')) return;
    if (session.studentId && String(session.studentId) !== String(userIdRef.current || '')) return;
    mergeTutorSession(session);
    if (event.type !== 'TUTOR_SESSION_OPENED') return;
    if (tutorOpenInFlightRef.current) {
      seedOpeningMessage(payload.openingMessage);
      return;
    }
    const conversationId = payload.conversationId;
    if (conversationId && conversationId !== activeSessionIdRef.current) {
      handleSelectSession(conversationId, 'Buổi học cùng AI Tutor', { silent: true }).then(() => {
        seedOpeningMessage(payload.openingMessage);
      });
      return;
    }
    seedOpeningMessage(payload.openingMessage);
  });

  useRealtimeReconnect(() => {
    if (!userIdRef.current || !courseIdRef.current || !classIdRef.current) return;
    openTutorSession();
  });

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
            conversationId: previousSessionId || '',
            tutorSessionId: activeTutorSession?.id || '',
            sessionPhase: activeTutorSession?.phase || 'TEACH',
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
            conversationId: previousSessionId || null,
            tutorSessionId: activeTutorSession?.id || null,
            sessionPhase: activeTutorSession?.phase || 'TEACH',
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
          conversationId: previousSessionId || null,
          tutorSessionId: activeTutorSession?.id || null,
          sessionPhase: activeTutorSession?.phase || 'TEACH',
        }, userId, currentUser?.fullName || '', currentUser?.email || '', {
          signal: requestController.signal,
        });
      }

      const responseConversationId = data.conversationId || previousSessionId;
      if (activeTutorSession?.id && activeSessionQuestionCount + 1 >= 10) {
        try {
          const summary = await tutorSessionApi.closeSession(activeTutorSession.id);
          setTutorSessionSummary(summary);
          setActiveTutorSession((session) => session ? {
            ...session,
            status: 'COMPLETED',
            phase: 'CLOSED',
            summaryId: summary?.id,
          } : session);
        } catch (summaryError) {
          console.warn('Tutor session summary could not be generated:', summaryError);
        }
      } else if (activeTutorSession && (data?.sessionPhase || Array.isArray(data?.suggestedTopics))) {
        setActiveTutorSession((session) => session ? {
          ...session,
          phase: data.sessionPhase || session.phase,
          supportLevel: data.supportLevel || session.supportLevel,
          suggestedTopics: Array.isArray(data.suggestedTopics) && data.suggestedTopics.length > 0
            ? data.suggestedTopics
            : session.suggestedTopics,
        } : session);
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

      if (didStartNewConversation && canonicalConversationId) {
        try {
          const chatMsgs = await conversationApi.getMessages(canonicalConversationId, userId, {
            skipUnauthorizedRedirect: true,
          });
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
    activeTutorSession,
    tutorSessionSummary,
    isTutorSessionLoading,
    openTutorSession,
  };
}

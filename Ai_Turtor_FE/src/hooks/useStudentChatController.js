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
  buildAiServiceErrorMessage,
  isAiServiceErrorText,
} from '../utils/errorMessages';
import { hasBrokenTextEncoding, repairMojibake } from '../utils/textEncoding';
import { useConversationSessions } from '../features/student/chat/useConversationSessions';
import {
  DAILY_COURSE_QUESTION_LIMIT,
  DAILY_SESSION_COMPLETE_MESSAGE,
  isDailyCourseQuotaError,
  normalizeDailyQuota,
} from '../constants/sessionQuota';
import { uiCopy } from '../constants/uiCopy';
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
const IN_FLIGHT_ANSWER_RETRY_DELAYS = [2000, 4000, 8000, 10000, 15000, 20000, 20000];

const fetchCanonicalAnswer = async ({ conversationId, userId, question, signal }) => {
  if (!conversationId || !userId) return null;
  const chatMessages = await conversationApi.getMessages(conversationId, userId, {
    signal,
    skipUnauthorizedRedirect: true,
  });
  const messagePairs = pairMessages(asArray(chatMessages, 'content', 'messages'));
  return findCanonicalExchange(messagePairs, question);
};

const recoverCanonicalAnswer = async ({ conversationId, userId, question, signal }) => {
  if (!conversationId || !userId) return null;

  for (const delayMs of CANONICAL_ANSWER_RETRY_DELAYS) {
    if (signal?.aborted) return null;
    if (delayMs > 0) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
    }
    if (signal?.aborted) return null;

    try {
      const exchange = await fetchCanonicalAnswer({ conversationId, userId, question, signal });
      if (exchange) return exchange;
    } catch (error) {
      if (signal?.aborted) return null;
      if (delayMs === CANONICAL_ANSWER_RETRY_DELAYS.at(-1)) throw error;
    }
  }

  return null;
};

const recoverInFlightAnswer = async ({
  conversationId,
  userId,
  question,
  signal,
  loadSessions,
}) => {
  let resolvedConversationId = conversationId;

  for (const delayMs of IN_FLIGHT_ANSWER_RETRY_DELAYS) {
    if (signal?.aborted) return null;
    await new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
    if (signal?.aborted) return null;

    if (!resolvedConversationId && typeof loadSessions === 'function') {
      try {
        const sessions = await loadSessions({ silent: true });
        const newest = Array.isArray(sessions) ? sessions[0] : null;
        resolvedConversationId = newest?.id || resolvedConversationId;
      } catch {
        // Keep polling while the first generate is still persisting.
      }
    }

    if (!resolvedConversationId) continue;

    try {
      const exchange = await fetchCanonicalAnswer({
        conversationId: resolvedConversationId,
        userId,
        question,
        signal,
      });
      if (exchange) {
        return {
          ...exchange,
          conversationId: resolvedConversationId,
        };
      }
    } catch {
      if (signal?.aborted) return null;
    }
  }

  return null;
};

const isN8nTimeoutError = (error) => (
  error?.details?.code === 'N8N_TIMEOUT' || error?.code === 'N8N_TIMEOUT'
);

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
  const [dailyQuota, setDailyQuota] = useState({
    used: 0,
    remaining: DAILY_COURSE_QUESTION_LIMIT,
    limit: DAILY_COURSE_QUESTION_LIMIT,
  });

  useEffect(() => {
    const sid = userId || studentId;
    if (!sid || !courseId) {
      setDailyQuota({
        used: 0,
        remaining: DAILY_COURSE_QUESTION_LIMIT,
        limit: DAILY_COURSE_QUESTION_LIMIT,
      });
      return undefined;
    }
    let cancelled = false;
    aiTutorApi.getQuestionQuota(sid, courseId).then((data) => {
      if (!cancelled) setDailyQuota(normalizeDailyQuota(data));
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [courseId, studentId, userId]);

  const applyQuotaPayload = (payload) => {
    if (payload == null) return null;
    if (payload.dailyQuestionUsed == null && payload.used == null
        && payload.dailyQuestionRemaining == null && payload.remaining == null) {
      return null;
    }
    const next = normalizeDailyQuota(payload);
    setDailyQuota(next);
    return next;
  };

  const seedOpeningMessage = (openingMessage) => {
    const turn = toOpeningTurn(openingMessage);
    if (!turn) return;
    setMessages((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const welcomeIndex = list.findIndex((item) => (
        item?.id === turn.id
        || String(item?.answer || '').trim() === turn.answer
        || (!String(item?.question || '').trim() && /chào mừng bạn đến với (?:buổi học|môn)/i.test(String(item?.answer || '')))
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

  const closeTutorSessionIfDailyComplete = async (remaining) => {
    if (!activeTutorSession?.id || remaining > 0) return;
    try {
      const summary = await tutorSessionApi.closeSession(activeTutorSession.id);
      setTutorSessionSummary(summary);
      setActiveTutorSession((session) => (session ? {
        ...session,
        status: 'COMPLETED',
        phase: 'CLOSED',
        summaryId: summary?.id,
      } : session));
    } catch (summaryError) {
      console.warn('Tutor session summary could not be generated:', summaryError);
    }
  };

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
          const quotaUserId = getStudentUserId();
          if (quotaUserId && courseId) {
            nextQuota = normalizeDailyQuota(await aiTutorApi.getQuestionQuota(quotaUserId, courseId));
            setDailyQuota(nextQuota);
          }
        } catch {
          nextQuota = null;
        }
      }
      if (nextQuota && nextQuota.remaining <= 0) {
        await closeTutorSessionIfDailyComplete(0);
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
        setDailyQuota((current) => ({
          ...current,
          used: current.limit,
          remaining: 0,
        }));
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
          const quotaUserId = getStudentUserId();
          if (quotaUserId && courseId) {
            const next = normalizeDailyQuota(await aiTutorApi.getQuestionQuota(quotaUserId, courseId));
            setDailyQuota(next);
            if (next.remaining <= 0) {
              await closeTutorSessionIfDailyComplete(0);
            }
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

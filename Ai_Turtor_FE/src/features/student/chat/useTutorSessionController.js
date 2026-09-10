import { useEffect, useRef, useState } from 'react';
import { REALTIME_EVENT_TYPES } from '../../realtime/realtimeEvents';
import { useRealtimeEvent, useRealtimeReconnect } from '../../realtime/realtimeContext';
import { getUserFacingError } from '../../../services/apiClient';
import { tutorSessionApi } from '../../../services/tutorSessionApi';

const getOpeningContent = (openingMessage) => String(openingMessage?.content || '').trim();

const toOpeningTurn = (openingMessage) => {
  const content = getOpeningContent(openingMessage);
  if (!content) return null;
  return {
    id: openingMessage?.messageId || openingMessage?.id || `opening-${content.slice(0, 24)}`,
    question: '',
    answer: content,
    proactive: true,
    mode: 'TUTOR',
  };
};

export function useTutorSessionController({
  userId,
  courseId,
  classId,
  activeSessionId,
  triggerToast,
  setMessages,
  loadChatSessions,
  bumpConversationActivity,
  handleSelectSession,
}) {
  const [activeTutorSession, setActiveTutorSession] = useState(null);
  const [tutorSessionSummary, setTutorSessionSummary] = useState(null);
  const [isTutorSessionLoading, setIsTutorSessionLoading] = useState(false);
  const tutorOpenInFlightRef = useRef(false);
  const activeSessionIdRef = useRef(activeSessionId);
  const courseIdRef = useRef(courseId);
  const userIdRef = useRef(userId);
  const classIdRef = useRef(classId);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
    courseIdRef.current = courseId;
    userIdRef.current = userId;
    classIdRef.current = classId;
  }, [activeSessionId, classId, courseId, userId]);

  const seedOpeningMessage = (openingMessage) => {
    const turn = toOpeningTurn(openingMessage);
    if (!turn) return;

    setMessages((current) => {
      const messages = Array.isArray(current) ? current : [];
      const welcomeIndex = messages.findIndex((item) => (
        item?.id === turn.id
        || String(item?.answer || '').trim() === turn.answer
        || (!String(item?.question || '').trim()
          && /chào mừng bạn đến với (?:buổi học|môn)/i.test(String(item?.answer || '')))
      ));
      if (welcomeIndex < 0) return [turn, ...messages];

      const nextMessages = [...messages];
      nextMessages[welcomeIndex] = {
        ...nextMessages[welcomeIndex],
        ...turn,
        id: nextMessages[welcomeIndex].id || turn.id,
      };
      return nextMessages;
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
    if (!userId || !courseId || !classId || isTutorSessionLoading || tutorOpenInFlightRef.current) {
      return null;
    }

    tutorOpenInFlightRef.current = true;
    setIsTutorSessionLoading(true);
    try {
      const data = await tutorSessionApi.openSession({
        studentId: userId,
        courseId,
        classId,
      }, { skipUnauthorizedRedirect: true });
      const session = data?.session || null;
      mergeTutorSession(session);
      setTutorSessionSummary(null);

      const conversationId = data?.conversationId;
      await loadChatSessions({ silent: true });
      if (conversationId) {
        bumpConversationActivity({
          conversationId,
          title: 'Buổi học cùng AI Tutor',
          messageCountIncrement: getOpeningContent(data?.openingMessage) ? 1 : 0,
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
    } catch (error) {
      console.warn('Tutor session summary could not be generated:', error);
    }
  };

  const applyTutorResponse = (data) => {
    if (!activeTutorSession || (!data?.sessionPhase && !Array.isArray(data?.suggestedTopics))) return;
    setActiveTutorSession((session) => session ? {
      ...session,
      phase: data.sessionPhase || session.phase,
      supportLevel: data.supportLevel || session.supportLevel,
      suggestedTopics: Array.isArray(data.suggestedTopics) && data.suggestedTopics.length > 0
        ? data.suggestedTopics
        : session.suggestedTopics,
    } : session);
  };

  return {
    activeTutorSession,
    tutorSessionSummary,
    isTutorSessionLoading,
    openTutorSession,
    closeTutorSessionIfDailyComplete,
    applyTutorResponse,
  };
}

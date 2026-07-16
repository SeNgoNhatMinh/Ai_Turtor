import { useEffect, useRef, useState } from 'react';
import { conversationApi } from '../../../services/conversationApi';
import { getUserFacingError } from '../../../services/apiClient';
import { asArray, normalizeSession, pairMessages } from '../../../services/normalizers';
import { hasBrokenTextEncoding, repairMojibake } from '../../../utils/textEncoding';
import {
  CHAT_TURN_LIMIT,
  getSessionQuestionCount,
  sortSessionsByActivity,
} from './conversations/sessionUtils';

const clampQuestionCount = (value) => {
  const count = Number(value);
  return Math.max(0, Math.min(CHAT_TURN_LIMIT, Number.isFinite(count) ? count : 0));
};

const countQuestionsInMessages = (items) => (
  Array.isArray(items)
    ? items.filter((message) => String(message?.question || '').trim()).length
    : 0
);

export function useConversationSessions({
  currentUser,
  studentId,
  courseId,
  classId,
  triggerToast,
}) {
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeSessionTitle, setActiveSessionTitle] = useState('Trò chuyện với AI Tutor');
  const [sessions, setSessions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  const [turnLimitNotice, setTurnLimitNotice] = useState(null);
  const sessionsRequestRef = useRef(null);
  const messagesRequestRef = useRef(null);
  const userId = studentId || currentUser?.userId || currentUser?.id || '';

  useEffect(() => () => {
    sessionsRequestRef.current?.abort();
    messagesRequestRef.current?.abort();
  }, []);

  const resetChat = () => {
    sessionsRequestRef.current?.abort();
    messagesRequestRef.current?.abort();
    setActiveSessionId(null);
    setActiveSessionTitle('Trò chuyện với AI Tutor');
    setMessages([]);
    setSessions([]);
    setTurnLimitNotice(null);
  };

  const loadChatSessions = async () => {
    if (!userId || !courseId) {
      setSessions([]);
      return;
    }
    sessionsRequestRef.current?.abort();
    const controller = new AbortController();
    sessionsRequestRef.current = controller;
    setIsSessionsLoading(true);
    try {
      const data = await conversationApi.getConversations(userId, courseId, {
        signal: controller.signal,
        force: true,
      });
      if (!controller.signal.aborted) {
        setSessions(sortSessionsByActivity(asArray(data, 'content', 'conversations').map(normalizeSession)));
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.warn('Unable to load chat sessions:', error);
        setSessions([]);
      }
    } finally {
      if (sessionsRequestRef.current === controller) {
        sessionsRequestRef.current = null;
        setIsSessionsLoading(false);
      }
    }
  };

  const bumpConversationActivity = ({
    conversationId,
    title,
    lastMessageAt = new Date().toISOString(),
    messageCountIncrement = 1,
    questionCountIncrement = 0,
    questionCount,
    maxTurnsReached,
  }) => {
    if (!conversationId) return;
    setSessions((current) => {
      const list = Array.isArray(current) ? current : [];
      const existing = list.find((session) => session.id === conversationId);
      const existingQuestionCount = getSessionQuestionCount(existing);
      const nextQuestionCount = questionCount != null
        ? clampQuestionCount(questionCount)
        : clampQuestionCount(existingQuestionCount + questionCountIncrement);
      const candidateTitle = repairMojibake(
        title || existing?.title || activeSessionTitle || `AI Tutor - ${courseId || 'Môn học'}`,
      ).trim();
      const nextSession = {
        ...(existing || {}),
        id: conversationId,
        conversationId,
        title: !candidateTitle || hasBrokenTextEncoding(candidateTitle) ? 'Cuộc trò chuyện mới' : candidateTitle,
        courseId: existing?.courseId || courseId,
        classId: existing?.classId || classId,
        createdAt: existing?.createdAt || lastMessageAt,
        lastMessageAt,
        messageCount: Math.max(0, Number(existing?.messageCount || 0) + messageCountIncrement),
        userQuestionCount: nextQuestionCount,
        maxTurnsReached: Boolean(maxTurnsReached ?? existing?.maxTurnsReached ?? nextQuestionCount >= CHAT_TURN_LIMIT),
      };
      return sortSessionsByActivity([nextSession, ...list.filter((session) => session.id !== conversationId)]);
    });
  };

  const handleSelectSession = async (sessionId, title) => {
    if (!userId) {
      triggerToast('Vui lòng đăng nhập để mở lịch sử trò chuyện.');
      return;
    }
    messagesRequestRef.current?.abort();
    const controller = new AbortController();
    messagesRequestRef.current = controller;
    setActiveSessionId(sessionId);
    setActiveSessionTitle(repairMojibake(title) || 'Cuộc trò chuyện mới');
    setTurnLimitNotice(null);
    setMessages([]);
    try {
      const chatMessages = await conversationApi.getMessages(sessionId, userId, { signal: controller.signal });
      if (!controller.signal.aborted) {
        setMessages(pairMessages(asArray(chatMessages, 'content', 'messages')));
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        triggerToast(getUserFacingError(error, 'Không thể mở cuộc trò chuyện này.'));
      }
    } finally {
      if (messagesRequestRef.current === controller) messagesRequestRef.current = null;
    }
  };

  const handleCreateSession = async () => {
    if (!userId) {
      triggerToast('Vui lòng đăng nhập trước khi tạo cuộc trò chuyện.');
      return;
    }
    if (!courseId || !classId) {
      triggerToast('Tài khoản chưa được ghi danh vào lớp. Vui lòng liên hệ Admin hoặc giáo viên.');
      return;
    }
    const data = await conversationApi.createConversation(userId, courseId, classId);
    const session = normalizeSession(data);
    setActiveSessionId(session.id);
    setActiveSessionTitle(session.title);
    setTurnLimitNotice(null);
    setSessions((current) => sortSessionsByActivity([
      session,
      ...(Array.isArray(current) ? current.filter((item) => item.id !== session.id) : []),
    ]));
    setMessages([]);
    triggerToast('Đã tạo cuộc trò chuyện mới.');
  };

  const handleDeleteSession = async (sessionId) => {
    if (!userId) {
      triggerToast('Vui lòng đăng nhập trước khi xóa cuộc trò chuyện.');
      return;
    }
    await conversationApi.deleteConversation(sessionId, userId);
    triggerToast('Đã xóa cuộc trò chuyện.');
    setSessions((current) => current.filter((session) => session.id !== sessionId));
    setTurnLimitNotice((current) => (
      current?.previousSessionId === sessionId || current?.currentSessionId === sessionId ? null : current
    ));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setActiveSessionTitle('Trò chuyện với AI Tutor');
      setMessages([]);
    }
  };

  const handleRenameSession = async (sessionId, newTitle) => {
    if (!userId) {
      triggerToast('Vui lòng đăng nhập trước khi đổi tên cuộc trò chuyện.');
      return;
    }
    await conversationApi.renameConversation(sessionId, newTitle, userId);
    triggerToast('Đã đổi tên cuộc trò chuyện.');
    setSessions((current) => current.map((session) => (
      session.id === sessionId ? { ...session, title: newTitle } : session
    )));
    if (activeSessionId === sessionId) setActiveSessionTitle(newTitle);
  };

  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const messageQuestionCount = countQuestionsInMessages(messages);
  const activeSessionQuestionCount = clampQuestionCount(
    activeSession ? getSessionQuestionCount(activeSession) : messageQuestionCount,
  );
  const activeSessionMaxTurnsReached = Boolean(
    activeSessionId && (activeSession?.maxTurnsReached || activeSessionQuestionCount >= CHAT_TURN_LIMIT),
  );

  return {
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
    dismissTurnLimitNotice: () => setTurnLimitNotice(null),
    resetChat,
    loadChatSessions,
    handleSelectSession,
    handleCreateSession,
    handleDeleteSession,
    handleRenameSession,
  };
}

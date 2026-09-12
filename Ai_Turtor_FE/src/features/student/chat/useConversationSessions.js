import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../app/queryKeys';
import { conversationApi } from '../../../services/conversationApi';
import { getUserFacingError } from '../../../services/apiClient';
import { asArray, normalizeSession, pairMessages } from '../../../services/normalizers';
import { hasBrokenTextEncoding, repairMojibake } from '../../../utils/textEncoding';
import {
  CHAT_TURN_LIMIT,
  getSessionQuestionCount,
  sortSessionsByActivity,
} from './conversations/sessionUtils';

const DEFAULT_SESSION_TITLE = 'Trò chuyện với AI Tutor';
const SESSION_STALE_TIME_MS = 10_000;
const MESSAGE_STALE_TIME_MS = 5_000;
const EMPTY_LIST = [];

const clampQuestionCount = (value) => {
  const count = Number(value);
  return Math.max(0, Math.min(CHAT_TURN_LIMIT, Number.isFinite(count) ? count : 0));
};

const countQuestionsInMessages = (items) => (
  Array.isArray(items)
    ? items.filter((message) => String(message?.question || '').trim()).length
    : 0
);

const normalizeSessions = (data) => sortSessionsByActivity(
  asArray(data, 'content', 'conversations').map(normalizeSession),
);

const loadConversationMessages = async (sessionId, userId, options = {}) => pairMessages(
  asArray(
    await conversationApi.getMessages(sessionId, userId, options),
    'content',
    'messages',
  ),
);

export function useConversationSessions({
  currentUser,
  studentId,
  courseId,
  classId,
  triggerToast,
}) {
  const queryClient = useQueryClient();
  const [activeSessionIdState, setActiveSessionIdState] = useState(null);
  const [activeSessionTitle, setActiveSessionTitle] = useState(DEFAULT_SESSION_TITLE);
  const [sessionMutationKey, setSessionMutationKey] = useState('');
  const [turnLimitNotice, setTurnLimitNotice] = useState(null);
  const sessionMutationRef = useRef('');
  const activeSessionIdRef = useRef(null);
  const userId = studentId || currentUser?.userId || currentUser?.id || '';
  const sessionsQueryKey = useMemo(
    () => queryKeys.conversations(userId, courseId),
    [courseId, userId],
  );
  const messagesQueryKey = useMemo(
    () => queryKeys.conversationMessages(activeSessionIdState, userId),
    [activeSessionIdState, userId],
  );

  const sessionsQuery = useQuery({
    queryKey: sessionsQueryKey,
    queryFn: async ({ signal }) => normalizeSessions(
      await conversationApi.getConversations(userId, courseId, { signal }),
    ),
    enabled: Boolean(userId && courseId),
    staleTime: SESSION_STALE_TIME_MS,
    retry: 1,
  });

  const messagesQuery = useQuery({
    queryKey: messagesQueryKey,
    queryFn: ({ signal }) => loadConversationMessages(activeSessionIdState, userId, {
      signal,
      skipUnauthorizedRedirect: true,
    }),
    enabled: Boolean(userId && activeSessionIdState),
    staleTime: MESSAGE_STALE_TIME_MS,
    retry: 1,
  });

  const sessions = sessionsQuery.data || EMPTY_LIST;
  const messages = messagesQuery.data || EMPTY_LIST;

  const setSessions = useCallback((updater) => {
    queryClient.setQueryData(sessionsQueryKey, (current = []) => (
      typeof updater === 'function' ? updater(current) : updater
    ));
  }, [queryClient, sessionsQueryKey]);

  const setMessages = useCallback((updater) => {
    const currentSessionId = activeSessionIdRef.current;
    const key = queryKeys.conversationMessages(currentSessionId, userId);
    queryClient.setQueryData(key, (current = []) => (
      typeof updater === 'function' ? updater(current) : updater
    ));
  }, [queryClient, userId]);

  const setActiveSessionId = useCallback((value) => {
    const previousSessionId = activeSessionIdRef.current;
    const nextSessionId = typeof value === 'function' ? value(previousSessionId) : value;

    if (nextSessionId && previousSessionId !== nextSessionId) {
      const previousKey = queryKeys.conversationMessages(previousSessionId, userId);
      const nextKey = queryKeys.conversationMessages(nextSessionId, userId);
      const previousMessages = queryClient.getQueryData(previousKey);
      const nextMessages = queryClient.getQueryData(nextKey);
      const hasPendingTurn = Array.isArray(previousMessages)
        && previousMessages.some((message) => message?.pending);

      if (hasPendingTurn && !Array.isArray(nextMessages)) {
        queryClient.setQueryData(nextKey, previousMessages);
        queryClient.setQueryData(
          previousKey,
          previousMessages.filter((message) => !message?.pending),
        );
      }
    }

    activeSessionIdRef.current = nextSessionId || null;
    setActiveSessionIdState(nextSessionId || null);
  }, [queryClient, userId]);

  const resetChat = useCallback(() => {
    setActiveSessionId(null);
    setActiveSessionTitle(DEFAULT_SESSION_TITLE);
    setTurnLimitNotice(null);
  }, [setActiveSessionId]);

  const runSessionMutation = useCallback(async (key, operation) => {
    if (sessionMutationRef.current) return false;
    sessionMutationRef.current = key;
    setSessionMutationKey(key);
    try {
      await operation();
      return true;
    } finally {
      sessionMutationRef.current = '';
      setSessionMutationKey('');
    }
  }, []);

  const loadChatSessions = useCallback(async ({ silent = false } = {}) => {
    if (!userId || !courseId) return [];
    try {
      await queryClient.invalidateQueries({
        queryKey: sessionsQueryKey,
        exact: true,
        refetchType: 'none',
      });
      return await queryClient.fetchQuery({
        queryKey: sessionsQueryKey,
        queryFn: async ({ signal }) => normalizeSessions(
          await conversationApi.getConversations(userId, courseId, {
            signal,
            skipUnauthorizedRedirect: silent,
          }),
        ),
        staleTime: 0,
      });
    } catch (error) {
      console.warn('Unable to load chat sessions:', error);
      return queryClient.getQueryData(sessionsQueryKey) || [];
    }
  }, [courseId, queryClient, sessionsQueryKey, userId]);

  const bumpConversationActivity = useCallback(({
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
  }, [activeSessionTitle, classId, courseId, setSessions]);

  const handleSelectSession = useCallback(async (sessionId, title, options = {}) => {
    if (!userId) {
      triggerToast('Vui lòng đăng nhập để mở lịch sử trò chuyện.');
      return false;
    }
    setActiveSessionId(sessionId);
    setActiveSessionTitle(repairMojibake(title) || 'Cuộc trò chuyện mới');
    setTurnLimitNotice(null);
    try {
      await queryClient.fetchQuery({
        queryKey: queryKeys.conversationMessages(sessionId, userId),
        queryFn: ({ signal }) => loadConversationMessages(sessionId, userId, {
          signal,
          skipUnauthorizedRedirect: options.silent,
        }),
        staleTime: MESSAGE_STALE_TIME_MS,
      });
      return true;
    } catch (error) {
      if (!options.silent) {
        triggerToast(getUserFacingError(error, 'Không thể mở cuộc trò chuyện này.'));
      }
      return false;
    }
  }, [queryClient, setActiveSessionId, triggerToast, userId]);

  const createMutation = useMutation({
    mutationFn: () => conversationApi.createConversation(userId, courseId, classId),
  });
  const deleteMutation = useMutation({
    mutationFn: (sessionId) => conversationApi.deleteConversation(sessionId, userId),
  });
  const renameMutation = useMutation({
    mutationFn: ({ sessionId, newTitle }) => conversationApi.renameConversation(
      sessionId,
      newTitle,
      userId,
    ),
  });

  const handleCreateSession = useCallback(async () => {
    if (!userId) {
      triggerToast('Vui lòng đăng nhập trước khi tạo cuộc trò chuyện.');
      return false;
    }
    if (!courseId || !classId) {
      triggerToast('Tài khoản chưa được ghi danh vào lớp. Vui lòng liên hệ Admin hoặc giáo viên.');
      return false;
    }
    try {
      return await runSessionMutation('create', async () => {
        const session = normalizeSession(await createMutation.mutateAsync());
        if (!session.id) throw new Error('Backend did not return a conversation ID.');
        setActiveSessionId(session.id);
        setActiveSessionTitle(session.title);
        setTurnLimitNotice(null);
        setSessions((current) => sortSessionsByActivity([
          session,
          ...(Array.isArray(current) ? current.filter((item) => item.id !== session.id) : []),
        ]));
        queryClient.setQueryData(queryKeys.conversationMessages(session.id, userId), []);
        triggerToast('Đã tạo cuộc trò chuyện mới.');
      });
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể tạo cuộc trò chuyện mới.'));
      return false;
    }
  }, [classId, courseId, createMutation, queryClient, runSessionMutation, setActiveSessionId, setSessions, triggerToast, userId]);

  const handleDeleteSession = useCallback(async (sessionId) => {
    if (!userId) {
      triggerToast('Vui lòng đăng nhập trước khi xóa cuộc trò chuyện.');
      return false;
    }
    try {
      return await runSessionMutation(`delete:${sessionId}`, async () => {
        await deleteMutation.mutateAsync(sessionId);
        setSessions((current) => current.filter((session) => session.id !== sessionId));
        queryClient.removeQueries({
          queryKey: queryKeys.conversationMessages(sessionId, userId),
          exact: true,
        });
        queryClient.removeQueries({
          queryKey: queryKeys.pinnedConversationMessages(sessionId, userId),
          exact: true,
        });
        setTurnLimitNotice((current) => (
          current?.previousSessionId === sessionId || current?.currentSessionId === sessionId ? null : current
        ));
        if (activeSessionIdRef.current === sessionId) {
          setActiveSessionId(null);
          setActiveSessionTitle(DEFAULT_SESSION_TITLE);
        }
        triggerToast('Đã xóa cuộc trò chuyện.');
      });
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể xóa cuộc trò chuyện.'));
      return false;
    }
  }, [deleteMutation, queryClient, runSessionMutation, setActiveSessionId, setSessions, triggerToast, userId]);

  const handleRenameSession = useCallback(async (sessionId, newTitle) => {
    if (!userId) {
      triggerToast('Vui lòng đăng nhập trước khi đổi tên cuộc trò chuyện.');
      return false;
    }
    try {
      return await runSessionMutation(`rename:${sessionId}`, async () => {
        await renameMutation.mutateAsync({ sessionId, newTitle });
        setSessions((current) => current.map((session) => (
          session.id === sessionId ? { ...session, title: newTitle } : session
        )));
        if (activeSessionIdRef.current === sessionId) setActiveSessionTitle(newTitle);
        triggerToast('Đã đổi tên cuộc trò chuyện.');
      });
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể đổi tên cuộc trò chuyện.'));
      return false;
    }
  }, [renameMutation, runSessionMutation, setSessions, triggerToast, userId]);

  const activeSession = sessions.find((session) => session.id === activeSessionIdState);
  const messageQuestionCount = countQuestionsInMessages(messages);
  const activeSessionQuestionCount = clampQuestionCount(
    activeSession ? getSessionQuestionCount(activeSession) : messageQuestionCount,
  );
  const activeSessionMaxTurnsReached = Boolean(
    activeSessionIdState && (activeSession?.maxTurnsReached || activeSessionQuestionCount >= CHAT_TURN_LIMIT),
  );

  return {
    userId,
    activeSessionId: activeSessionIdState,
    activeSessionTitle,
    sessions,
    messages,
    isSessionsLoading: sessionsQuery.isPending,
    isMessagesLoading: messagesQuery.isPending && Boolean(activeSessionIdState),
    sessionMutationKey,
    isCreatingSession: sessionMutationKey === 'create',
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

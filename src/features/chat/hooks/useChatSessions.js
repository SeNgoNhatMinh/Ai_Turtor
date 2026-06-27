import { useCallback } from 'react';
import { useAuthStore } from '../../../app/store/authStore';
import { useUiStore } from '../../../app/store/uiStore';
import { useChatStore } from '../../../app/store/chatStore';
import { apiService } from '../../../services/api';
import { normalizeSession, asArray, pairMessages } from '../../../services/normalizers';
import { getUserFacingError } from '../../../services/apiClient';

export function useChatSessions() {
  const getStudentUserId = useAuthStore(state => state.getStudentUserId);
  const courseId = useUiStore(state => state.courseId);
  const triggerToast = useUiStore(state => state.setToastMessage);

  const {
    sessions, setSessions,
    activeSessionId, setActiveSessionId,
    setActiveSessionTitle,
    setMessages,
    setPinnedChatMessages
  } = useChatStore();

  const loadChatSessions = useCallback(async (keyword = '') => {
    const userId = getStudentUserId();
    if (!userId) return;
    try {
      let data;
      if (keyword.trim()) {
        data = await apiService.searchConversations(userId, keyword, courseId);
      } else {
        data = await apiService.getConversations(userId, courseId);
      }
      setSessions(asArray(data, 'content').map(normalizeSession));
    } catch (error) {
      console.warn('Failed to load chat sessions:', error);
    }
  }, [getStudentUserId, courseId, setSessions]);

  const loadMessages = useCallback(async (sessionId) => {
    try {
      const data = await apiService.getMessages(sessionId, getStudentUserId());
      setMessages(pairMessages(asArray(data, 'content', 'messages')));
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Could not load chat history.'));
    }
  }, [getStudentUserId, setMessages, triggerToast]);

  const selectSession = useCallback(async (sessionId, title) => {
    if (!sessionId || sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    setActiveSessionTitle(title || `AI Tutor Chat - ${courseId}`);
    setMessages([]);
    setPinnedChatMessages([]);
    await loadMessages(sessionId);
    // Ideally load pinned messages as well here
  }, [activeSessionId, courseId, setActiveSessionId, setActiveSessionTitle, setMessages, setPinnedChatMessages, loadMessages]);

  const createSession = useCallback(async () => {
    const userId = getStudentUserId();
    if (!userId) {
      triggerToast('Please sign in first.');
      return;
    }
    try {
      const data = await apiService.createConversation(userId, courseId);
      const newSessionId = data.id || data.conversationId;
      if (newSessionId) {
        await loadChatSessions();
        await selectSession(newSessionId, data.title || 'New Chat');
        triggerToast('New chat started.');
      }
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Failed to create new chat.'));
    }
  }, [getStudentUserId, courseId, triggerToast, loadChatSessions, selectSession]);

  const deleteSession = useCallback(async (sessionId) => {
    try {
      await apiService.deleteConversation(sessionId, getStudentUserId());
      triggerToast('Chat deleted.');
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setActiveSessionTitle('AI Tutor Chat');
        setMessages([]);
        setPinnedChatMessages([]);
      }
      loadChatSessions();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Failed to delete chat.'));
    }
  }, [getStudentUserId, activeSessionId, setActiveSessionId, setActiveSessionTitle, setMessages, setPinnedChatMessages, loadChatSessions, triggerToast]);

  const renameSession = useCallback(async (sessionId, newTitle) => {
    try {
      await apiService.renameConversation(sessionId, newTitle, getStudentUserId());
      if (activeSessionId === sessionId) {
        setActiveSessionTitle(newTitle);
      }
      loadChatSessions();
      triggerToast('Chat renamed.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Failed to rename chat.'));
    }
  }, [getStudentUserId, activeSessionId, setActiveSessionTitle, loadChatSessions, triggerToast]);

  return {
    sessions,
    activeSessionId,
    loadChatSessions,
    selectSession,
    createSession,
    deleteSession,
    renameSession
  };
}

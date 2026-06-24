import { useCallback, useState } from 'react';
import { conversationApi } from '../services/conversationApi';
import { asArray, normalizeSession, pairMessages } from '../services/normalizers';

export function useChatSessions(userId) {
  const [sessions, setSessions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeSessionTitle, setActiveSessionTitle] = useState('AI Tutor Chat');
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      return [];
    }
    setIsLoadingSessions(true);
    try {
      const data = await conversationApi.getConversations(userId);
      const nextSessions = asArray(data, 'content', 'conversations').map(normalizeSession);
      setSessions(nextSessions);
      return nextSessions;
    } finally {
      setIsLoadingSessions(false);
    }
  }, [userId]);

  const selectSession = useCallback(async (sessionId, title) => {
    if (!userId) throw new Error('Please sign in before opening chat history.');
    setActiveSessionId(sessionId);
    setActiveSessionTitle(title);
    const data = await conversationApi.getMessages(sessionId, userId);
    const nextMessages = pairMessages(asArray(data, 'content', 'messages'));
    setMessages(nextMessages);
    return nextMessages;
  }, [userId]);

  return {
    sessions,
    setSessions,
    messages,
    setMessages,
    activeSessionId,
    setActiveSessionId,
    activeSessionTitle,
    setActiveSessionTitle,
    isLoadingSessions,
    loadSessions,
    selectSession,
  };
}

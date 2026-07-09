import { useRef, useState } from 'react';
import { apiService } from '../services/api';
import { getUserFacingError } from '../services/apiClient';
import { asArray, normalizeSession, pairMessages } from '../services/normalizers';
import { N8N_ENABLED } from '../services/n8nClient';
import { n8nService } from '../services/n8nService';

const getSessionActivityTime = (session) => {
  const value = session?.lastMessageAt || session?.updatedAt || session?.createdAt;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const sortSessionsByActivity = (items) => {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => getSessionActivityTime(b) - getSessionActivityTime(a));
};

const CHAT_TURN_LIMIT = 10;

const toFiniteNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const clampQuestionCount = (value) => Math.max(0, Math.min(CHAT_TURN_LIMIT, toFiniteNumber(value, 0)));

const getSessionQuestionCount = (session) => {
  if (!session) return 0;
  if (session.userQuestionCount != null) return clampQuestionCount(session.userQuestionCount);
  if (session.questionCount != null) return clampQuestionCount(session.questionCount);
  return clampQuestionCount(Math.floor(toFiniteNumber(session.messageCount, 0) / 2));
};

const countQuestionsInMessages = (items) => (
  Array.isArray(items)
    ? items.filter((message) => String(message?.question || '').trim()).length
    : 0
);

const AI_SERVICE_ERROR_PATTERNS = [
  /chưa thể gọi dịch vụ llm/i,
  /llm call failed/i,
  /request timed out/i,
  /ai tutor service is temporarily unavailable/i,
];

const AI_SERVICE_ERROR_MESSAGE = [
  'AI Tutor could not reach the language model right now.',
  '',
  'You can retry this question in a moment or ask a mentor for help.',
].join('\n');

const isAiServiceErrorText = (value) => {
  const text = String(value || '');
  return AI_SERVICE_ERROR_PATTERNS.some((pattern) => pattern.test(text));
};

const buildAiServiceErrorMessage = (fallback = '') => (
  isAiServiceErrorText(fallback) || !fallback
    ? AI_SERVICE_ERROR_MESSAGE
    : fallback
);

export function useStudentChatController({
  currentUser,
  courseId,
  classId,
  triggerToast,
  setCodeMentorDiagnostics,
}) {
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeSessionTitle, setActiveSessionTitle] = useState('AI Tutor Chat');
  const [sessions, setSessions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  const [turnLimitNotice, setTurnLimitNotice] = useState(null);
  const activeAiRequestIdRef = useRef(0);
  const canceledAiRequestIdsRef = useRef(new Set());

  const getStudentUserId = () => currentUser?.userId || currentUser?.id || '';

  const resetChat = () => {
    setActiveSessionId(null);
    setActiveSessionTitle('AI Tutor Chat');
    setMessages([]);
    setSessions([]);
    setTurnLimitNotice(null);
  };

  const loadChatSessions = async () => {
    const userId = getStudentUserId();
    if (!userId) {
      setSessions([]);
      return;
    }
    setIsSessionsLoading(true);
    try {
      const data = await apiService.getConversations(userId, courseId);
      setSessions(sortSessionsByActivity(asArray(data, 'content', 'conversations').map(normalizeSession)));
    } catch {
      setSessions([]);
    } finally {
      setIsSessionsLoading(false);
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

    setSessions((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const existing = list.find((session) => session.id === conversationId);
      const existingQuestionCount = getSessionQuestionCount(existing);
      const nextQuestionCount = questionCount != null
        ? clampQuestionCount(questionCount)
        : clampQuestionCount(existingQuestionCount + questionCountIncrement);
      const nextSession = {
        ...(existing || {}),
        id: conversationId,
        conversationId,
        title: title || existing?.title || activeSessionTitle || `AI Tutor Chat - ${courseId || 'Course'}`,
        courseId: existing?.courseId || courseId,
        classId: existing?.classId || classId,
        createdAt: existing?.createdAt || lastMessageAt,
        lastMessageAt,
        messageCount: Math.max(0, Number(existing?.messageCount || 0) + messageCountIncrement),
        userQuestionCount: nextQuestionCount,
        maxTurnsReached: Boolean(maxTurnsReached ?? existing?.maxTurnsReached ?? nextQuestionCount >= CHAT_TURN_LIMIT),
      };
      const nextList = [nextSession, ...list.filter((session) => session.id !== conversationId)];
      return sortSessionsByActivity(nextList);
    });
  };

  const handleSelectSession = async (sessionId, title) => {
    const userId = getStudentUserId();
    if (!userId) {
      triggerToast('Please sign in before opening chat history.');
      return;
    }
    setActiveSessionId(sessionId);
    setActiveSessionTitle(title);
    setTurnLimitNotice(null);
    setMessages([]);
    const chatMsgs = await apiService.getMessages(sessionId, userId);
    setMessages(pairMessages(asArray(chatMsgs, 'content', 'messages')));
  };

  const handleCreateSession = async () => {
    const userId = getStudentUserId();
    if (!userId) {
      triggerToast('Please sign in before creating a conversation.');
      return;
    }
    const data = await apiService.createConversation(userId, courseId);
    const session = normalizeSession(data);
    setActiveSessionId(session.id);
    setActiveSessionTitle(session.title);
    setTurnLimitNotice(null);
    setSessions((prev) => sortSessionsByActivity([session, ...(Array.isArray(prev) ? prev.filter((item) => item.id !== session.id) : [])]));
    setMessages([]);
    triggerToast('New conversation created.');
  };

  const handleDeleteSession = async (sessionId) => {
    const userId = getStudentUserId();
    if (!userId) {
      triggerToast('Please sign in before deleting a conversation.');
      return;
    }
    await apiService.deleteConversation(sessionId, userId);
    triggerToast('Conversation deleted.');
    setSessions((prev) => prev.filter((session) => session.id !== sessionId));
    setTurnLimitNotice((current) => (
      current?.previousSessionId === sessionId || current?.currentSessionId === sessionId ? null : current
    ));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setActiveSessionTitle('AI Tutor Chat');
      setMessages([]);
    }
  };

  const handleRenameSession = async (sessionId, newTitle) => {
    const userId = getStudentUserId();
    if (!userId) {
      triggerToast('Please sign in before renaming a conversation.');
      return;
    }
    await apiService.renameConversation(sessionId, newTitle, userId);
    triggerToast('Conversation renamed.');
    setSessions((prev) => prev.map((session) => (
      session.id === sessionId ? { ...session, title: newTitle } : session
    )));
    if (activeSessionId === sessionId) {
      setActiveSessionTitle(newTitle);
    }
  };

  const handleSendQuery = async (chatInput, codeSnippet, setAvatarEmotion) => {
    const text = chatInput.trim();
    const userId = getStudentUserId();
    if (!userId) {
      triggerToast('Please sign in before sending a message.');
      return;
    }
    const previousSessionId = activeSessionId;
    const previousSessionTitle = activeSessionTitle;
    const requestId = activeAiRequestIdRef.current + 1;
    activeAiRequestIdRef.current = requestId;
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
            codeSnippet: codeSnippet || '',
            conversationId: previousSessionId || ''
          });
        } catch (n8nError) {
          console.warn('n8n request failed, trying backend API fallback:', n8nError);
          triggerToast('n8n offline. Falling back to local AI...');
          data = await apiService.sendAiQuery({
            question: text,
            message: text,
            codeSnippet: codeSnippet || null,
            courseId,
            classId,
            conversationId: previousSessionId || null
          }, userId, currentUser?.fullName || '', currentUser?.email || '');
        }
      } else {
        data = await apiService.sendAiQuery({
          question: text,
          message: text,
          codeSnippet: codeSnippet || null,
          courseId,
          classId,
          conversationId: previousSessionId || null
        }, userId, currentUser?.fullName || '', currentUser?.email || '');
      }

      const responseConversationId = data.conversationId || data.sessionId || previousSessionId;
      const responseConversationTitle = data.conversationTitle || data.title || previousSessionTitle || `AI Tutor Chat - ${courseId || 'Course'}`;
      const didStartNewConversation = Boolean(previousSessionId && responseConversationId && responseConversationId !== previousSessionId);

      if (responseConversationId && responseConversationId !== previousSessionId) {
        setActiveSessionId(responseConversationId);
        setActiveSessionTitle(responseConversationTitle);
      }

      if (didStartNewConversation) {
        setTurnLimitNotice({
          type: 'turn-limit',
          previousSessionId,
          currentSessionId: responseConversationId,
          message: 'This chat reached 10 questions. AI Tutor started a new conversation to keep answers focused.',
        });
      }

      bumpConversationActivity({
        conversationId: responseConversationId,
        title: responseConversationTitle,
        lastMessageAt: data.lastMessageAt || data.updatedAt || new Date().toISOString(),
        messageCountIncrement: responseConversationId === previousSessionId ? 0 : 1,
        questionCountIncrement: responseConversationId === previousSessionId ? 0 : 1,
        questionCount: data.userQuestionCount ?? data.questionCount,
        maxTurnsReached: data.maxTurnsReached,
      });

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
          conversationId: responseConversationId,
          mode: data.mode || 'RAG',
          confidence: data.confidence,
          sources: data.sources || [],
          questionEscalationId: data.questionEscalationId || data.escalationId || null,
          aiServiceError: isAiServiceError,
          retryable: isAiServiceError,
          pending: false
        };
        return updated;
      });

      if (didStartNewConversation) {
        try {
          const chatMsgs = await apiService.getMessages(responseConversationId, userId);
          const historyPairs = pairMessages(asArray(chatMsgs, 'content', 'messages'));
          if (historyPairs.length > 0) {
            setMessages(historyPairs);
          }
        } catch {
          // Keep the just-submitted exchange visible if history reload is not ready yet.
        }
      }

      if (data.mode === 'CODE' || data.mode === 'CODE_MENTOR') {
        setCodeMentorDiagnostics(data.answer);
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
        const friendlyError = getUserFacingError(error, 'AI Tutor could not answer right now. Please try again in a moment.');
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
      triggerToast(getUserFacingError(error, 'AI Tutor request failed. Please try again in a moment.'));
    }
  };

  const handleStopAiGeneration = () => {
    const requestId = activeAiRequestIdRef.current;
    if (requestId) canceledAiRequestIdsRef.current.add(requestId);
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
          answer: 'Response generation was stopped. You can edit your question or try another prompt.',
          pending: false,
          canceled: true,
        };
      }
      return updated;
    });
  };

  const openLearnedSuggestionResponse = async (data = {}, fallbackSuggestionText = '') => {
    const userId = getStudentUserId();
    if (!userId) {
      triggerToast('Please sign in before opening this study suggestion.');
      return;
    }

    const responseConversationId = data.conversationId || data.sessionId || activeSessionId;
    const responseConversationTitle = data.conversationTitle || data.title || activeSessionTitle || `AI Tutor Chat - ${courseId || 'Course'}`;
    const clickedSuggestion = String(data.clickedSuggestion || fallbackSuggestionText || '').trim();
    const fallbackQuestion = clickedSuggestion
      ? `Study suggestion: ${clickedSuggestion}`
      : 'Study this suggestion step by step.';
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
        const chatMsgs = await apiService.getMessages(responseConversationId, userId);
        const historyPairs = pairMessages(asArray(chatMsgs, 'content', 'messages'));
        if (historyPairs.length > 0) {
          setMessages(historyPairs);
          await loadChatSessions();
          return;
        }
      } catch {
        // The backend already saved the turn. Keep the returned answer visible if history is not ready yet.
      }
    }

    setMessages([
      {
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
        questionEscalationId: data.questionEscalationId || data.escalationId || null,
        clickedSuggestion,
        suggestionConsumed: data.suggestionConsumed,
        aiServiceError: isAiServiceError,
        retryable: isAiServiceError,
        pending: false,
      },
    ]);
    await loadChatSessions();
  };

  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const messageQuestionCount = countQuestionsInMessages(messages);
  const activeSessionQuestionCount = clampQuestionCount(
    activeSession ? getSessionQuestionCount(activeSession) : messageQuestionCount,
  );
  const activeSessionMaxTurnsReached = Boolean(
    activeSessionId && (activeSession?.maxTurnsReached || activeSessionQuestionCount >= CHAT_TURN_LIMIT),
  );
  const dismissTurnLimitNotice = () => setTurnLimitNotice(null);

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

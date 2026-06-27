import { useRef, useState } from 'react';
import { apiService } from '../services/api';
import { getUserFacingError } from '../services/apiClient';
import { asArray, normalizeSession, pairMessages } from '../services/normalizers';
import { N8N_ENABLED } from '../services/n8nClient';
import { n8nService } from '../services/n8nService';

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
  const activeAiRequestIdRef = useRef(0);
  const canceledAiRequestIdsRef = useRef(new Set());

  const getStudentUserId = () => currentUser?.userId || currentUser?.id || '';

  const resetChat = () => {
    setActiveSessionId(null);
    setActiveSessionTitle('AI Tutor Chat');
    setMessages([]);
    setSessions([]);
  };

  const loadChatSessions = async () => {
    const userId = getStudentUserId();
    if (!userId) {
      setSessions([]);
      return;
    }
    try {
      const data = await apiService.getConversations(userId);
      setSessions(asArray(data, 'content', 'conversations').map(normalizeSession));
    } catch {
      setSessions([]);
    }
  };

  const handleSelectSession = async (sessionId, title) => {
    const userId = getStudentUserId();
    if (!userId) {
      triggerToast('Please sign in before opening chat history.');
      return;
    }
    setActiveSessionId(sessionId);
    setActiveSessionTitle(title);
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
    const data = await apiService.createConversation(userId);
    const session = normalizeSession(data);
    setActiveSessionId(session.id);
    setActiveSessionTitle(session.title);
    setMessages([]);
    triggerToast('New conversation created.');
    loadChatSessions();
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
    const requestId = activeAiRequestIdRef.current + 1;
    activeAiRequestIdRef.current = requestId;
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
            conversationId: activeSessionId || ''
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
            conversationId: activeSessionId || null
          }, userId);
        }
      } else {
        data = await apiService.sendAiQuery({
          question: text,
          message: text,
          codeSnippet: codeSnippet || null,
          courseId,
          classId,
          conversationId: activeSessionId || null
        }, userId);
      }

      if (data.conversationId && !activeSessionId) {
        setActiveSessionId(data.conversationId);
        loadChatSessions();
      }

      if (canceledAiRequestIdsRef.current.has(requestId)) {
        canceledAiRequestIdsRef.current.delete(requestId);
        return;
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          question: text,
          answer: data.answer,
          mode: data.mode || 'RAG',
          confidence: data.confidence,
          sources: data.sources || [],
          questionEscalationId: data.questionEscalationId || data.escalationId || null,
          pending: false
        };
        return updated;
      });

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
        updated[updated.length - 1] = {
          question: text,
          answer: getUserFacingError(error, 'AI Tutor could not answer right now. Please try again in a moment.'),
          confidence: 0,
          sources: [],
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

  return {
    activeSessionId,
    activeSessionTitle,
    sessions,
    messages,
    resetChat,
    loadChatSessions,
    handleSelectSession,
    handleCreateSession,
    handleDeleteSession,
    handleRenameSession,
    handleSendQuery,
    handleStopAiGeneration,
  };
}

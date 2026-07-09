import { useCallback } from 'react';
import { useAuthStore } from '../../../app/store/authStore';
import { useUiStore } from '../../../app/store/uiStore';
import { useChatStore } from '../../../app/store/chatStore';
import { apiService } from '../../../services/api';
import { n8nService } from '../../../services/n8nService';
import { N8N_ENABLED } from '../../../services/n8nClient';
import { pairMessages, asArray } from '../../../services/normalizers';
import { getUserFacingError } from '../../../services/apiClient';

export function useChat() {
  const getStudentUserId = useAuthStore(state => state.getStudentUserId);
  const currentUser = useAuthStore(state => state.currentUser);
  const courseId = useUiStore(state => state.courseId);
  const classId = useUiStore(state => state.classId);
  const triggerToast = useUiStore(state => state.setToastMessage);

  const {
    messages, setMessages,
    pinnedChatMessages, setPinnedChatMessages,
    activeSessionId, setActiveSessionId,
    activeSessionTitle, setActiveSessionTitle,
    incrementActiveAiRequestId,
    cancelAiRequest,
    canceledAiRequestIds
  } = useChatStore();

  const loadChatSessions = useCallback(async (keyword = '') => {
    // Implement in useChatSessions or leave here if simple
  }, []);

  const loadPinnedChatMessages = useCallback(async (sessionId = activeSessionId) => {
    if (!sessionId) return;
    try {
      const msgs = await apiService.getPinnedMessages(sessionId, getStudentUserId());
      setPinnedChatMessages(Array.isArray(msgs) ? msgs : msgs?.content || []);
    } catch (error) {
      console.warn('Failed to load pinned messages:', error);
      setPinnedChatMessages([]);
    }
  }, [activeSessionId, getStudentUserId, setPinnedChatMessages]);

  const handleSendQuery = useCallback(async (chatInput, codeSnippet, setAvatarEmotion = () => {}) => {
    const text = chatInput.trim();
    const userId = getStudentUserId();
    if (!userId) {
      triggerToast('Please sign in before sending a message.');
      return;
    }
    const requestId = incrementActiveAiRequestId();
    const userMsg = { question: text, answer: null, pending: true, requestId };
    setMessages([...messages, userMsg]);

    try {
      let data;
      if (N8N_ENABLED) {
        try {
          const n8nPayload = {
            studentId: userId,
            studentName: currentUser?.fullName || '',
            studentEmail: currentUser?.email || '',
            courseId: courseId,
            classId: classId,
            message: text,
            codeSnippet: codeSnippet || '',
            conversationId: activeSessionId || ''
          };
          data = await n8nService.sendStudentChat(n8nPayload);
        } catch (n8nError) {
          triggerToast('n8n offline. Falling back to local AI...');
          const payload = { question: text, message: text, codeSnippet: codeSnippet || null, courseId, classId, conversationId: activeSessionId || null };
          data = await apiService.sendAiQuery(payload, userId, currentUser?.fullName || '', currentUser?.email || '');
        }
      } else {
        const payload = { question: text, message: text, codeSnippet: codeSnippet || null, courseId, classId, conversationId: activeSessionId || null };
        data = await apiService.sendAiQuery(payload, userId, currentUser?.fullName || '', currentUser?.email || '');
      }

      const responseConversationId = data.conversationId || data.sessionId || activeSessionId;
      if (responseConversationId && responseConversationId !== activeSessionId) {
        setActiveSessionId(responseConversationId);
        setActiveSessionTitle(data.conversationTitle || data.title || `AI Tutor Chat - ${courseId}`);
        setPinnedChatMessages([]);
        // Ideally reload sessions
        loadPinnedChatMessages(responseConversationId);
      } else if (responseConversationId) {
        loadPinnedChatMessages(responseConversationId);
      }

      // Check if canceled
      if (useChatStore.getState().canceledAiRequestIds.has(requestId)) {
        useChatStore.getState().cancelAiRequest(requestId); // dummy removal
        return;
      }

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          question: text,
          answer: data.answer,
          id: data.assistantMessageId || data.messageId || data.aiMessageId || data.responseMessageId,
          messageId: data.assistantMessageId || data.messageId || data.aiMessageId || data.responseMessageId,
          assistantMessageId: data.assistantMessageId || data.messageId || data.aiMessageId || data.responseMessageId,
          userMessageId: data.userMessageId,
          conversationId: responseConversationId,
          mode: data.mode || 'RAG',
          confidence: data.confidence,
          sources: data.sources || [],
          questionEscalationId: data.questionEscalationId || data.escalationId || null,
          pending: false
        };
        return updated;
      });

      if (responseConversationId) {
        try {
          const chatMsgs = await apiService.getMessages(responseConversationId, userId);
          setMessages(pairMessages(asArray(chatMsgs, 'content', 'messages')));
        } catch {}
      }

      if (data.mode === 'CODE' || data.mode === 'CODE_MENTOR') {
        setAvatarEmotion('success');
      } else if (data.escalated || data.mode === 'ESCALATE') {
        setAvatarEmotion('idle');
      } else {
        setAvatarEmotion('success');
      }
    } catch (error) {
      if (useChatStore.getState().canceledAiRequestIds.has(requestId)) return;
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          question: text,
          answer: getUserFacingError(error, 'AI Tutor could not answer right now. Please try again in a moment.'),
          confidence: 0, sources: [], pending: false
        };
        return updated;
      });
      setAvatarEmotion('idle');
      triggerToast(getUserFacingError(error, 'AI Tutor request failed.'));
    }
  }, [getStudentUserId, incrementActiveAiRequestId, messages, setMessages, currentUser, courseId, classId, activeSessionId, setActiveSessionId, setActiveSessionTitle, setPinnedChatMessages, loadPinnedChatMessages, triggerToast]);

  const handleStopAiGeneration = useCallback(() => {
    const requestId = useChatStore.getState().activeAiRequestId;
    if (requestId) cancelAiRequest(requestId);
    setMessages(prev => {
      const updated = [...prev];
      let index = -1;
      for (let i = updated.length - 1; i >= 0; i -= 1) {
        if (updated[i]?.pending) { index = i; break; }
      }
      if (index >= 0) {
        updated[index] = { ...updated[index], pending: false, answer: updated[index].answer || 'AI response generation stopped.' };
      }
      return updated;
    });
  }, [cancelAiRequest, setMessages]);

  return {
    messages,
    pinnedChatMessages,
    sendMessage: handleSendQuery,
    stopGeneration: handleStopAiGeneration,
    loadPinnedChatMessages
  };
}

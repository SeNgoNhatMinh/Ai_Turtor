import { useCallback, useRef, useState } from 'react';
import { chatApi } from '../services/chatApi';
import { validateChatInput } from '../utils/validators';

export function useAiChat({ userId, userName = '', userEmail = '', courseId, classId, conversationId }) {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const requestIdRef = useRef(0);

  const sendMessage = useCallback(async (input, codeSnippet = '') => {
    if (!userId) throw new Error('Please sign in before sending a message.');
    const validation = validateChatInput(input);
    if (!validation.ok) throw new Error(validation.message);

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setIsAiLoading(true);
    try {
      const data = await chatApi.sendAiQuery({
        question: validation.value,
        message: validation.value,
        codeSnippet: codeSnippet || null,
        courseId,
        classId,
        conversationId: conversationId || null,
      }, userId, userName, userEmail);
      return { requestId, question: validation.value, data };
    } finally {
      setIsAiLoading(false);
    }
  }, [classId, conversationId, courseId, userId, userName, userEmail]);

  return { sendMessage, isAiLoading };
}

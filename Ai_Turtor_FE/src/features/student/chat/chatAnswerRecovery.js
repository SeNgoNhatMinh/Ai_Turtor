import { conversationApi } from '../../../services/conversationApi';
import { asArray, pairMessages } from '../../../services/normalizers';
import { findCanonicalExchange } from './conversations/sessionUtils';

const CANONICAL_ANSWER_RETRY_DELAYS = [0, 350, 800];
const IN_FLIGHT_ANSWER_RETRY_DELAYS = [2000, 4000, 8000, 10000, 15000, 20000, 20000];

const wait = (delayMs) => new Promise((resolve) => {
  globalThis.setTimeout(resolve, delayMs);
});

const fetchCanonicalAnswer = async ({ conversationId, userId, question, signal }) => {
  if (!conversationId || !userId) return null;

  const chatMessages = await conversationApi.getMessages(conversationId, userId, {
    signal,
    skipUnauthorizedRedirect: true,
  });
  const messagePairs = pairMessages(asArray(chatMessages, 'content', 'messages'));
  return findCanonicalExchange(messagePairs, question);
};

export const recoverCanonicalAnswer = async ({ conversationId, userId, question, signal }) => {
  if (!conversationId || !userId) return null;

  for (const delayMs of CANONICAL_ANSWER_RETRY_DELAYS) {
    if (signal?.aborted) return null;
    if (delayMs > 0) await wait(delayMs);
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

export const recoverInFlightAnswer = async ({
  conversationId,
  userId,
  question,
  signal,
  loadSessions,
}) => {
  let resolvedConversationId = conversationId;

  for (const delayMs of IN_FLIGHT_ANSWER_RETRY_DELAYS) {
    if (signal?.aborted) return null;
    await wait(delayMs);
    if (signal?.aborted) return null;

    if (!resolvedConversationId && typeof loadSessions === 'function') {
      try {
        const sessions = await loadSessions({ silent: true });
        resolvedConversationId = sessions?.[0]?.id || resolvedConversationId;
      } catch {
        // Keep polling while the first generated answer is being persisted.
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

export const isN8nTimeoutError = (error) => (
  error?.details?.code === 'N8N_TIMEOUT' || error?.code === 'N8N_TIMEOUT'
);

export const createMissingChatAnswerError = () => {
  const error = new Error('The AI workflow completed without a chat answer.');
  error.name = 'N8nError';
  error.code = 'N8N_CHAT_ANSWER_MISSING';
  error.userMessage = 'AI Tutor đã xử lý nhưng chưa đồng bộ được câu trả lời. Vui lòng thử lại.';
  return error;
};

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../app/queryKeys';
import { getUserFacingError } from '../../../services/apiClient';
import { conversationApi } from '../../../services/conversationApi';
import {
  getLegacyPinnedStorageKey,
  getMessageKey,
  getPinTargetId,
  normalizePinnedMessages,
} from './chatMessageUtils';

const MAX_PINNED_MESSAGES = 3;

export function usePinnedChatMessages({ userId, sessionId, messages, triggerToast }) {
  const queryClient = useQueryClient();
  const [highlightedMessageKey, setHighlightedMessageKey] = useState('');
  const pinnedQueryKey = useMemo(
    () => queryKeys.pinnedConversationMessages(sessionId, userId),
    [sessionId, userId],
  );
  const pinnedQuery = useQuery({
    queryKey: pinnedQueryKey,
    queryFn: async ({ signal }) => normalizePinnedMessages(
      await conversationApi.getPinnedMessages(sessionId, userId, { signal }),
    ),
    enabled: Boolean(userId && sessionId),
    staleTime: 30_000,
    retry: 1,
  });
  const refetchPinnedMessages = pinnedQuery.refetch;
  const serverMessages = useMemo(() => pinnedQuery.data || [], [pinnedQuery.data]);

  useEffect(() => {
    if (pinnedQuery.error) console.warn('Failed to load pinned chat messages:', pinnedQuery.error);
  }, [pinnedQuery.error]);

  const loadPinnedMessages = useCallback(async () => {
    if (!userId || !sessionId) return [];
    const result = await refetchPinnedMessages();
    return result.data || [];
  }, [refetchPinnedMessages, sessionId, userId]);

  const pinnedMessageIdSet = useMemo(
    () => new Set(serverMessages.map((item) => item.messageId).filter(Boolean)),
    [serverMessages],
  );

  const messageLookupById = useMemo(() => {
    const lookup = new Map();
    messages.forEach((message, index) => {
      const key = getMessageKey(message, index);
      [
        message?.assistantMessageId,
        message?.userMessageId,
        message?.messageId,
        message?.id,
      ].filter(Boolean).forEach((id) => {
        lookup.set(String(id), { message, key });
      });
    });
    return lookup;
  }, [messages]);

  const pinnedMessages = useMemo(() => serverMessages
    .slice(0, MAX_PINNED_MESSAGES)
    .map((pinned) => {
      const matched = messageLookupById.get(String(pinned.messageId));
      return {
        pinned,
        message: matched?.message || pinned,
        key: matched?.key || `pinned-${pinned.messageId}`,
        canJump: Boolean(matched?.key),
      };
    }), [messageLookupById, serverMessages]);

  const pinMutation = useMutation({
    mutationFn: async ({ messageId, isPinned }) => {
      if (isPinned) await conversationApi.unpinChatMessage(sessionId, messageId, userId);
      else await conversationApi.pinChatMessage(sessionId, messageId, userId);
      return { messageId, isPinned };
    },
    onSuccess: async ({ isPinned }) => {
      await queryClient.invalidateQueries({ queryKey: pinnedQueryKey });
      triggerToast?.(isPinned ? 'Đã bỏ ghim tin nhắn.' : 'Đã ghim tin nhắn.');
    },
    onError: (error, { isPinned }) => triggerToast?.(getUserFacingError(
      error,
      isPinned ? 'Không thể bỏ ghim tin nhắn.' : 'Không thể ghim tin nhắn.',
    )),
  });

  const togglePinnedMessage = useCallback(async (message) => {
    if (!userId || !sessionId) {
      triggerToast?.('Hãy mở một cuộc trò chuyện đã lưu trước khi ghim tin nhắn.');
      return;
    }
    const messageId = getPinTargetId(message);
    if (!messageId) {
      triggerToast?.('Tin nhắn chưa sẵn sàng để ghim. Hãy tải lại cuộc trò chuyện và thử lại.');
      return;
    }
    const isPinned = pinnedMessageIdSet.has(messageId);
    if (!isPinned && serverMessages.length >= MAX_PINNED_MESSAGES) {
      triggerToast?.(`Bạn chỉ có thể ghim tối đa ${MAX_PINNED_MESSAGES} tin nhắn.`);
      return;
    }

    try {
      await pinMutation.mutateAsync({ messageId, isPinned });
    } catch {
      // The mutation owns the user-facing error state.
    }
  }, [pinMutation, pinnedMessageIdSet, serverMessages.length, sessionId, triggerToast, userId]);

  const jumpToPinnedMessage = useCallback((messageKey) => {
    const target = document.querySelector(`[data-chat-message-key="${CSS.escape(messageKey)}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageKey(messageKey);
    window.setTimeout(() => {
      setHighlightedMessageKey((current) => (current === messageKey ? '' : current));
    }, 1600);
  }, []);

  useEffect(() => {
    if (!userId || !sessionId || messages.length === 0) return undefined;
    const storageKey = getLegacyPinnedStorageKey(userId, sessionId);
    if (!storageKey) return undefined;

    let legacyKeys = [];
    try {
      legacyKeys = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
    } catch {
      legacyKeys = [];
    }
    if (!Array.isArray(legacyKeys) || legacyKeys.length === 0) return undefined;

    let cancelled = false;
    const migrateLegacyPins = async () => {
      try {
        for (const legacyKey of legacyKeys.slice(0, MAX_PINNED_MESSAGES)) {
          const matched = messages.find((message, index) => getMessageKey(message, index) === legacyKey);
          const messageId = getPinTargetId(matched);
          if (messageId && !pinnedMessageIdSet.has(messageId)) {
            await conversationApi.pinChatMessage(sessionId, messageId, userId);
          }
        }
        window.localStorage.removeItem(storageKey);
        if (!cancelled) await loadPinnedMessages();
      } catch (error) {
        console.warn('Legacy pinned message migration failed:', error);
      }
    };

    migrateLegacyPins();
    return () => {
      cancelled = true;
    };
  }, [loadPinnedMessages, messages, pinnedMessageIdSet, sessionId, userId]);

  return {
    highlightedMessageKey,
    pinnedMessageIdSet,
    pinnedMessages,
    pinningMessageId: pinMutation.isPending ? pinMutation.variables?.messageId || '' : '',
    jumpToPinnedMessage,
    togglePinnedMessage,
  };
}

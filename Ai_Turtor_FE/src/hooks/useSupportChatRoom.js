import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../app/queryKeys';
import { env } from '../config/env';
import { getChatSenderRole, normalizeAccountRole } from '../constants/roles';
import { getAuthToken } from '../features/auth/services/tokenStorage';
import { getUserFacingError } from '../services/apiClient';
import { supportChatApi } from '../services/supportChatApi';

const getMessageId = (message) => String(message?.messageId || message?.id || '');

const mergeMessages = (current, incoming) => {
  const map = new Map();
  [...current, ...incoming].forEach((message) => {
    const id = getMessageId(message);
    const fallback = `${message?.senderId || ''}:${message?.sentAt || ''}:${message?.content || ''}`;
    map.set(id || fallback, message);
  });
  return [...map.values()].sort((a, b) => (
    new Date(a?.sentAt || 0).getTime() - new Date(b?.sentAt || 0).getTime()
  ));
};

const getSocketUrl = (chatRoomId) => {
  const token = getAuthToken();
  if (!chatRoomId || !token) return '';

  let endpoint = env.chatSocketUrl;
  if (!endpoint) {
    if (/^https?:\/\//i.test(env.apiBaseUrl)) {
      const apiUrl = new URL(env.apiBaseUrl);
      endpoint = `${apiUrl.protocol === 'https:' ? 'wss:' : 'ws:'}//${apiUrl.host}/ws/chat`;
    } else {
      endpoint = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/chat`;
    }
  }

  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}${new URLSearchParams({ chatRoomId, token })}`;
};

const loadChatRoom = async (chatRoomId, signal) => {
  const [history, detail] = await Promise.all([
    supportChatApi.getHistory(chatRoomId, { signal }),
    supportChatApi.getDetail(chatRoomId, { signal }),
  ]);
  return { messages: history.messages || [], detail: detail || null };
};

export function useSupportChatRoom({
  chatRoomId,
  currentUser,
  enabled = true,
  realtimeEnabled = true,
}) {
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] = useState('idle');
  const [socketRetry, setSocketRetry] = useState(0);
  const [actionError, setActionError] = useState('');
  const socketRef = useRef(null);

  const userId = currentUser?.userId || currentUser?.id || currentUser?._id || '';
  const senderName = currentUser?.fullName || currentUser?.name || currentUser?.email || userId;
  const accountRole = normalizeAccountRole(currentUser?.originalRole || currentUser?.role);
  const senderRole = getChatSenderRole(accountRole);
  const roomQueryKey = useMemo(() => queryKeys.supportChatRoom(chatRoomId), [chatRoomId]);
  const shouldPoll = enabled && realtimeEnabled && env.realtimeEnabled;

  const roomQuery = useQuery({
    queryKey: roomQueryKey,
    queryFn: ({ signal }) => loadChatRoom(chatRoomId, signal),
    enabled: enabled && Boolean(chatRoomId),
    staleTime: 2_000,
    refetchInterval: shouldPoll ? 5_000 : false,
  });
  const roomData = roomQuery.data;
  const messages = useMemo(() => roomData?.messages || [], [roomData?.messages]);
  const detail = roomData?.detail || null;

  const updateRoomData = useCallback((updater) => {
    queryClient.setQueryData(roomQueryKey, (current = { messages: [], detail: null }) => updater(current));
  }, [queryClient, roomQueryKey]);

  const markReadMutation = useMutation({
    mutationFn: () => supportChatApi.markRead(chatRoomId),
  });
  const markRead = markReadMutation.mutate;
  const latestMessageId = getMessageId(messages[messages.length - 1]);
  useEffect(() => {
    if (chatRoomId && enabled && latestMessageId) markRead();
  }, [chatRoomId, enabled, latestMessageId, markRead]);

  const refetchRoom = roomQuery.refetch;
  const loadRoom = useCallback(async () => {
    if (!chatRoomId || !enabled) return null;
    const result = await refetchRoom();
    return result.data || null;
  }, [chatRoomId, enabled, refetchRoom]);

  useEffect(() => {
    const socketUrl = getSocketUrl(chatRoomId);
    if (!socketUrl || !enabled || !realtimeEnabled || !env.realtimeEnabled) return undefined;

    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;
    let disposed = false;
    let reconnectTimer;
    const connectingTimer = window.setTimeout(() => setConnectionState('connecting'), 0);
    socket.onopen = () => {
      setConnectionState('connected');
      loadRoom();
    };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === 'ERROR') {
          setActionError('Không thể gửi tin nhắn hỗ trợ trực tiếp. Vui lòng thử lại.');
          return;
        }
        const message = payload?.message || payload;
        if (message?.content && (message?.messageId || message?.id)) {
          updateRoomData((current) => ({
            ...current,
            messages: mergeMessages(current.messages || [], [message]),
          }));
        }
      } catch (parseError) {
        console.warn('Ignored malformed support chat socket message.', parseError);
      }
    };
    socket.onerror = () => setConnectionState('fallback');
    socket.onclose = () => {
      if (disposed) return;
      setConnectionState('fallback');
      reconnectTimer = window.setTimeout(() => setSocketRetry((current) => current + 1), 3000);
    };

    return () => {
      disposed = true;
      socketRef.current = null;
      window.clearTimeout(connectingTimer);
      window.clearTimeout(reconnectTimer);
      socket.close();
    };
  }, [chatRoomId, enabled, loadRoom, realtimeEnabled, socketRetry, updateRoomData]);

  const sendAnswerMutation = useMutation({
    mutationFn: ({ content, candidateType }) => supportChatApi.sendAnswerAndIndex({
      chatRoomId,
      senderId: userId,
      senderName,
      senderRole,
      content,
      messageType: 'TEXT',
      createKnowledgeCandidate: true,
      candidateType,
    }),
    onMutate: () => setActionError(''),
    onSuccess: (sent) => updateRoomData((current) => ({
      ...current,
      messages: mergeMessages(current.messages || [], [sent]),
    })),
    onError: (error) => setActionError(
      getUserFacingError(error, 'Không thể gửi đáp án và tạo đề xuất tri thức.'),
    ),
  });

  const sendHttpMutation = useMutation({
    mutationFn: (content) => supportChatApi.sendMessage({
      chatRoomId,
      senderId: userId,
      senderName,
      senderRole,
      content,
      messageType: 'TEXT',
    }),
    onMutate: () => setActionError(''),
    onSuccess: (sent) => updateRoomData((current) => ({
      ...current,
      messages: mergeMessages(current.messages || [], [sent]),
    })),
    onError: (error) => setActionError(
      getUserFacingError(error, 'Không thể gửi tin nhắn này.'),
    ),
  });

  const closeMutation = useMutation({
    mutationFn: ({ rating, feedback }) => supportChatApi.closeRoom({
      chatRoomId,
      userRating: rating,
      userFeedback: feedback,
    }),
    onMutate: () => setActionError(''),
    onSuccess: () => updateRoomData((current) => ({
      ...current,
      detail: { ...(current.detail || {}), status: 'CLOSED' },
    })),
    onError: (error) => setActionError(
      getUserFacingError(error, 'Không thể đóng cuộc trao đổi hỗ trợ này.'),
    ),
  });

  const sendAnswerAndIndex = useCallback(async (content, candidateType = 'ACADEMIC_KNOWLEDGE') => {
    const trimmed = String(content || '').trim();
    if (!chatRoomId || !userId || !trimmed || sendAnswerMutation.isPending) return null;
    try {
      return await sendAnswerMutation.mutateAsync({ content: trimmed, candidateType });
    } catch {
      return null;
    }
  }, [chatRoomId, sendAnswerMutation, userId]);

  const sendMessage = useCallback(async (content) => {
    const trimmed = String(content || '').trim();
    if (!chatRoomId || !userId || !trimmed || sendHttpMutation.isPending) return false;
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'SEND_MESSAGE',
        senderName,
        content: trimmed,
        messageType: 'TEXT',
      }));
      setActionError('');
      return true;
    }
    try {
      await sendHttpMutation.mutateAsync(trimmed);
      return true;
    } catch {
      return false;
    }
  }, [chatRoomId, sendHttpMutation, senderName, userId]);

  const closeRoom = useCallback(async ({ rating, feedback } = {}) => {
    if (!chatRoomId || closeMutation.isPending) return false;
    try {
      await closeMutation.mutateAsync({ rating, feedback });
      return true;
    } catch {
      return false;
    }
  }, [chatRoomId, closeMutation]);

  const queryError = roomQuery.error
    ? getUserFacingError(roomQuery.error, 'Không thể tải cuộc trao đổi hỗ trợ này.')
    : '';

  return useMemo(() => ({
    messages,
    detail,
    isLoading: roomQuery.isPending,
    isSending: sendAnswerMutation.isPending || sendHttpMutation.isPending,
    isClosing: closeMutation.isPending,
    error: actionError || queryError,
    connectionState,
    senderRole,
    loadRoom,
    sendMessage,
    sendAnswerAndIndex,
    closeRoom,
  }), [
    actionError,
    closeMutation.isPending,
    closeRoom,
    connectionState,
    detail,
    loadRoom,
    messages,
    queryError,
    roomQuery.isPending,
    sendAnswerAndIndex,
    sendAnswerMutation.isPending,
    sendHttpMutation.isPending,
    sendMessage,
    senderRole,
  ]);
}

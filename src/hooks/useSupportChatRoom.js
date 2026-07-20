import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { env } from '../config/env';
import { getAuthToken } from '../features/auth/services/tokenStorage';
import { getChatSenderRole, normalizeAccountRole } from '../constants/roles';
import { supportChatApi } from '../services/supportChatApi';
import { getUserFacingError } from '../services/apiClient';

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

export function useSupportChatRoom({ chatRoomId, currentUser, enabled = true }) {
  const [messages, setMessages] = useState([]);
  const [detail, setDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState('');
  const [connectionState, setConnectionState] = useState('idle');
  const [socketRetry, setSocketRetry] = useState(0);
  const socketRef = useRef(null);

  const userId = currentUser?.userId || currentUser?.id || currentUser?._id || '';
  const senderName = currentUser?.fullName || currentUser?.name || currentUser?.email || userId;
  const accountRole = normalizeAccountRole(currentUser?.originalRole || currentUser?.role);
  const senderRole = getChatSenderRole(accountRole);

  const loadRoom = useCallback(async ({ silent = false } = {}) => {
    if (!chatRoomId || !enabled) {
      setMessages([]);
      setDetail(null);
      return;
    }
    if (!silent) setIsLoading(true);
    try {
      const [history, roomDetail] = await Promise.all([
        supportChatApi.getHistory(chatRoomId),
        supportChatApi.getDetail(chatRoomId),
      ]);
      setMessages((current) => mergeMessages(current, history.messages || []));
      setDetail(roomDetail || null);
      setError('');
      supportChatApi.markRead(chatRoomId).catch(() => {});
    } catch (requestError) {
      if (!silent) setError(getUserFacingError(requestError, 'Không thể tải cuộc trao đổi hỗ trợ này.'));
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [chatRoomId, enabled]);

  useEffect(() => {
    if (!chatRoomId || !enabled) return undefined;
    const timer = window.setTimeout(() => {
      setMessages([]);
      setDetail(null);
      setError('');
      loadRoom();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [chatRoomId, enabled, loadRoom]);

  useEffect(() => {
    if (!chatRoomId || !enabled) return undefined;
    const timer = window.setInterval(() => loadRoom({ silent: true }), 5000);
    return () => window.clearInterval(timer);
  }, [chatRoomId, enabled, loadRoom]);

  useEffect(() => {
    const socketUrl = getSocketUrl(chatRoomId);
    if (!socketUrl || !enabled) return undefined;

    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;
    let disposed = false;
    let reconnectTimer;
    const connectingTimer = window.setTimeout(() => setConnectionState('connecting'), 0);
    socket.onopen = () => {
      setConnectionState('connected');
      loadRoom({ silent: true });
    };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === 'ERROR') {
          setError('Không thể gửi tin nhắn hỗ trợ trực tiếp. Vui lòng thử lại.');
          return;
        }
        const message = payload?.message || payload;
        if (message?.content && (message?.messageId || message?.id)) {
          setMessages((current) => mergeMessages(current, [message]));
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
  }, [chatRoomId, enabled, loadRoom, socketRetry]);

  const sendMessage = useCallback(async (content) => {
    const trimmed = String(content || '').trim();
    if (!chatRoomId || !userId || !trimmed || isSending) return false;
    setIsSending(true);
    try {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'SEND_MESSAGE',
          senderName,
          content: trimmed,
          messageType: 'TEXT',
        }));
        setError('');
        return true;
      }
      const sent = await supportChatApi.sendMessage({
        chatRoomId,
        senderId: userId,
        senderName,
        senderRole,
        content: trimmed,
        messageType: 'TEXT',
      });
      setMessages((current) => mergeMessages(current, [sent]));
      setError('');
      return true;
    } catch (requestError) {
      setError(getUserFacingError(requestError, 'Không thể gửi tin nhắn này.'));
      return false;
    } finally {
      setIsSending(false);
    }
  }, [chatRoomId, isSending, senderName, senderRole, userId]);

  const closeRoom = useCallback(async ({ rating, feedback } = {}) => {
    if (!chatRoomId || isClosing) return false;
    setIsClosing(true);
    try {
      await supportChatApi.closeRoom({
        chatRoomId,
        userRating: rating,
        userFeedback: feedback,
      });
      setDetail((current) => ({ ...current, status: 'CLOSED' }));
      setError('');
      return true;
    } catch (requestError) {
      setError(getUserFacingError(requestError, 'Không thể đóng cuộc trao đổi hỗ trợ này.'));
      return false;
    } finally {
      setIsClosing(false);
    }
  }, [chatRoomId, isClosing]);

  return useMemo(() => ({
    messages,
    detail,
    isLoading,
    isSending,
    isClosing,
    error,
    connectionState,
    senderRole,
    loadRoom,
    sendMessage,
    closeRoom,
  }), [
    closeRoom,
    connectionState,
    detail,
    error,
    isClosing,
    isLoading,
    isSending,
    loadRoom,
    messages,
    sendMessage,
    senderRole,
  ]);
}

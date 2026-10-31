import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../app/queryKeys';
import { notificationsApi } from '../../services/notificationsApi';
import { useRealtimeEvent } from '../realtime/realtimeContext';
import { REALTIME_EVENT_TYPES } from '../realtime/realtimeEvents';
import { notificationFromRealtimeEvent, upsertNotification } from './notificationModel';

const EMPTY = { notifications: [], unreadCount: 0 };

const NOTIFICATION_EVENT_TYPES = [
  ...REALTIME_EVENT_TYPES.supportEscalation,
  ...REALTIME_EVENT_TYPES.knowledgeCandidate,
  ...REALTIME_EVENT_TYPES.expertContributions,
];

export function useNotifications(userId, { onArrived } = {}) {
  const queryClient = useQueryClient();
  const resolvedUserId = String(userId || '').trim();
  const queryKey = queryKeys.userNotifications(resolvedUserId);

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => notificationsApi.list({ signal }),
    enabled: Boolean(resolvedUserId),
    staleTime: 15_000,
  });

  useRealtimeEvent(NOTIFICATION_EVENT_TYPES, (event) => {
    const incoming = notificationFromRealtimeEvent(event);
    if (!incoming) return;
    const current = queryClient.getQueryData(queryKey);
    const next = upsertNotification(current || EMPTY, incoming);
    if (next === current) return;
    queryClient.setQueryData(queryKey, next);
    onArrived?.(incoming);
  });

  const markRead = useCallback(async (notificationId) => {
    if (!notificationId) return;
    const readAt = new Date().toISOString();
    queryClient.setQueryData(queryKey, (current = EMPTY) => {
      const notifications = (current.notifications || []).map((item) => (
        item.id === notificationId ? { ...item, readAt, unread: false } : item
      ));
      return {
        notifications,
        unreadCount: notifications.filter((item) => item.unread).length,
      };
    });
    await notificationsApi.markRead(notificationId);
  }, [queryClient, queryKey]);

  const markAllRead = useCallback(async () => {
    const readAt = new Date().toISOString();
    queryClient.setQueryData(queryKey, (current = EMPTY) => ({
      notifications: (current.notifications || []).map((item) => ({ ...item, readAt, unread: false })),
      unreadCount: 0,
    }));
    await notificationsApi.markAllRead();
  }, [queryClient, queryKey]);

  return {
    notifications: query.data?.notifications || EMPTY.notifications,
    unreadCount: query.data?.unreadCount || 0,
    isLoading: query.isPending,
    markRead,
    markAllRead,
  };
}

import { API_BASE_URL, request } from './apiClient';
import { encodePath } from '../config/env';
import { asArray } from './normalizers';
import { normalizeNotification } from '../features/notifications/notificationModel';

export const notificationsApi = {
  async list(options = {}) {
    const data = await request(`${API_BASE_URL}/notifications`, { signal: options.signal });
    const notifications = asArray(data, 'notifications').map(normalizeNotification);
    return {
      notifications,
      unreadCount: Number(data?.unreadCount ?? notifications.filter((item) => item.unread).length) || 0,
    };
  },

  async markRead(notificationId) {
    return request(`${API_BASE_URL}/notifications/${encodePath(notificationId)}/read`, { method: 'POST' });
  },

  async markAllRead() {
    return request(`${API_BASE_URL}/notifications/read`, { method: 'POST' });
  },
};

import { API_BASE_URL, request } from './apiClient';
import { encodePath } from '../config/env';

export const conversationApi = {
  async getConversations(userId, courseId) {
    const params = new URLSearchParams({ userId });
    if (courseId) params.append('courseId', courseId);
    return request(`${API_BASE_URL}/ai/conversations?${params}`);
  },

  async searchConversations(userId, keyword, courseId) {
    const params = new URLSearchParams({ userId, keyword });
    if (courseId) params.append('courseId', courseId);
    return request(`${API_BASE_URL}/ai/conversations/search?${params}`);
  },

  async createConversation(userId, courseId, classId = '') {
    const params = new URLSearchParams({ userId });
    if (courseId) params.append('courseId', courseId);
    if (classId) params.append('classId', classId);
    return request(`${API_BASE_URL}/ai/conversations?${params}`, { method: 'POST' });
  },

  async getMessages(conversationId, userId) {
    const params = new URLSearchParams({ userId });
    return request(`${API_BASE_URL}/ai/conversations/${encodePath(conversationId)}/messages?${params}`);
  },

  async deleteConversation(conversationId, userId) {
    const params = new URLSearchParams({ userId });
    return request(`${API_BASE_URL}/ai/conversations/${encodePath(conversationId)}?${params}`, { method: 'DELETE' });
  },

  async renameConversation(conversationId, title, userId) {
    return request(`${API_BASE_URL}/ai/conversations/${encodePath(conversationId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, userId }),
    });
  },

  async pinChatMessage(conversationId, messageId, userId) {
    const params = new URLSearchParams({ userId });
    return request(`${API_BASE_URL}/ai/conversations/${encodePath(conversationId)}/messages/${encodePath(messageId)}/pin?${params}`, {
      method: 'PATCH',
    });
  },

  async unpinChatMessage(conversationId, messageId, userId) {
    const params = new URLSearchParams({ userId });
    return request(`${API_BASE_URL}/ai/conversations/${encodePath(conversationId)}/messages/${encodePath(messageId)}/pin?${params}`, {
      method: 'DELETE',
    });
  },

  async getPinnedMessages(conversationId, userId) {
    const params = new URLSearchParams({ userId });
    return request(`${API_BASE_URL}/ai/conversations/${encodePath(conversationId)}/pinned-messages?${params}`);
  },
};

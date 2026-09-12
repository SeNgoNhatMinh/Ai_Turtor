import { API_BASE_URL, request } from './apiClient';
import { encodePath } from '../config/env';
import { fetchServerQuery, invalidateServerQueries } from './queryCache';

const conversationQueryKey = (userId, courseId) => ['conversations', userId, courseId || 'all'];

export const conversationApi = {
  async getConversations(userId, courseId, options = {}) {
    const params = new URLSearchParams({ userId });
    if (courseId) params.append('courseId', courseId);
    const loader = ({ signal } = {}) => request(`${API_BASE_URL}/ai/conversations?${params}`, {
      signal: options.signal || signal,
      skipUnauthorizedRedirect: options.skipUnauthorizedRedirect,
    });
    if (options.signal) return loader();
    return fetchServerQuery(conversationQueryKey(userId, courseId), loader, {
      force: options.force,
      staleTime: 10_000,
    });
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
    const response = await request(`${API_BASE_URL}/ai/conversations?${params}`, { method: 'POST' });
    invalidateServerQueries(['conversations']);
    return response;
  },

  async getMessages(conversationId, userId, options = {}) {
    const params = new URLSearchParams({ userId });
    return request(`${API_BASE_URL}/ai/conversations/${encodePath(conversationId)}/messages?${params}`, {
      signal: options.signal,
      skipUnauthorizedRedirect: options.skipUnauthorizedRedirect,
    });
  },

  async deleteConversation(conversationId, userId) {
    const params = new URLSearchParams({ userId });
    const response = await request(`${API_BASE_URL}/ai/conversations/${encodePath(conversationId)}?${params}`, { method: 'DELETE' });
    invalidateServerQueries(['conversations']);
    return response;
  },

  async renameConversation(conversationId, title, userId) {
    const response = await request(`${API_BASE_URL}/ai/conversations/${encodePath(conversationId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, userId }),
    });
    invalidateServerQueries(['conversations']);
    return response;
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

  async recordUnderstandingCheck(conversationId, messageId, userId, selectedKey) {
    return request(`${API_BASE_URL}/ai/conversations/${encodePath(conversationId)}/messages/${encodePath(messageId)}/understanding-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, selectedKey }),
    });
  },

  async getPinnedMessages(conversationId, userId) {
    const params = new URLSearchParams({ userId });
    return request(`${API_BASE_URL}/ai/conversations/${encodePath(conversationId)}/pinned-messages?${params}`, {
      skipUnauthorizedRedirect: true,
    });
  },
};

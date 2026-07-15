import { API_BASE_URL, request } from './apiClient';
import { encodePath } from '../config/env';
import { getCachedResource, invalidateResourceCache } from './requestCache';

const conversationCacheKey = (userId, courseId) => `conversations:${userId}:${courseId || 'all'}`;

export const conversationApi = {
  async getConversations(userId, courseId, options = {}) {
    const params = new URLSearchParams({ userId });
    if (courseId) params.append('courseId', courseId);
    const loader = () => request(`${API_BASE_URL}/ai/conversations?${params}`, { signal: options.signal });
    if (options.signal) return loader();
    return getCachedResource(conversationCacheKey(userId, courseId), loader, {
      force: options.force,
      ttlMs: 10000,
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
    invalidateResourceCache('conversations:');
    return response;
  },

  async getMessages(conversationId, userId, options = {}) {
    const params = new URLSearchParams({ userId });
    return request(`${API_BASE_URL}/ai/conversations/${encodePath(conversationId)}/messages?${params}`, {
      signal: options.signal,
    });
  },

  async deleteConversation(conversationId, userId) {
    const params = new URLSearchParams({ userId });
    const response = await request(`${API_BASE_URL}/ai/conversations/${encodePath(conversationId)}?${params}`, { method: 'DELETE' });
    invalidateResourceCache('conversations:');
    return response;
  },

  async renameConversation(conversationId, title, userId) {
    const response = await request(`${API_BASE_URL}/ai/conversations/${encodePath(conversationId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, userId }),
    });
    invalidateResourceCache('conversations:');
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

  async getPinnedMessages(conversationId, userId) {
    const params = new URLSearchParams({ userId });
    return request(`${API_BASE_URL}/ai/conversations/${encodePath(conversationId)}/pinned-messages?${params}`);
  },
};

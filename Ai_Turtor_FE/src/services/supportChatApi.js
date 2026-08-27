import { API_BASE_URL, request } from './apiClient';
import { asArray } from './normalizers';

const encodePath = (value) => encodeURIComponent(String(value ?? ''));
const preserveSession = { skipUnauthorizedRedirect: true };

export const supportChatApi = {
  async getEscalationHistory(userId) {
    const params = new URLSearchParams({ userId });
    return asArray(
      await request(`${API_BASE_URL}/tutor/escalations/history?${params}`, preserveSession),
      'escalations',
      'content',
    );
  },

  async createEscalation(payload) {
    return request(`${API_BASE_URL}/tutor/escalations`, {
      ...preserveSession,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async getEscalationDetail(escalationId) {
    return request(`${API_BASE_URL}/tutor/escalations/${encodePath(escalationId)}`, preserveSession);
  },

  async offerMentors(escalationId) {
    const params = new URLSearchParams({ questionEscalationId: escalationId });
    return request(`${API_BASE_URL}/tutor/escalations/offer?${params}`, {
      ...preserveSession,
      method: 'POST',
    });
  },

  async selectMentor(payload) {
    return request(`${API_BASE_URL}/tutor/escalations/select`, {
      ...preserveSession,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async getHistory(chatRoomId, { page = 0, size = 100 } = {}) {
    const params = new URLSearchParams({
      chatRoomId,
      page: String(page),
      size: String(size),
    });
    const response = await request(`${API_BASE_URL}/chat/history?${params}`, preserveSession);
    return {
      ...response,
      messages: asArray(response, 'messages', 'content').slice().reverse(),
    };
  },

  async getDetail(chatRoomId) {
    const params = new URLSearchParams({ chatRoomId });
    return request(`${API_BASE_URL}/chat/detail?${params}`, preserveSession);
  },

  async getUnreadRooms() {
    return request(`${API_BASE_URL}/chat/unread`, preserveSession);
  },

  async sendMessage(payload) {
    return request(`${API_BASE_URL}/chat/send`, {
      ...preserveSession,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async sendAnswerAndIndex(payload) {
    return request(`${API_BASE_URL}/chat/send-answer-and-index`, {
      ...preserveSession,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async markRead(chatRoomId) {
    return request(`${API_BASE_URL}/chat/mark-read`, {
      ...preserveSession,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatRoomId }),
    });
  },

  async closeRoom({ chatRoomId, userRating, userFeedback }) {
    return request(`${API_BASE_URL}/chat/close`, {
      ...preserveSession,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatRoomId,
        ...(userRating ? { userRating: Number(userRating) } : {}),
        ...(userFeedback?.trim() ? { userFeedback: userFeedback.trim() } : {}),
      }),
    });
  },
};

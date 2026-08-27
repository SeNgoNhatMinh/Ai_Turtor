import { API_BASE_URL, request } from './apiClient';
import { encodePath } from '../config/env';
import { asArray } from './normalizers';

const BASE = `${API_BASE_URL}/admin/indexed-teaching-notes`;

const query = (values = {}) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : '';
};

const normalizeApprovedRagIndex = (item = {}) => ({
  ...item,
  id: item.id || '',
  courseId: item.courseId || '',
  chapter: item.chapter || 'Chưa xác định chương',
  question: item.question || '',
  approvedAnswer: item.approvedAnswer || item.goldAnswer || item.answer || '',
  status: String(item.status || 'INDEXED').trim().toUpperCase(),
  sourceType: item.sourceType || 'SENIOR_APPROVED_V2_ANSWER',
  authorId: item.authorId || '',
  reviewedBy: item.reviewedBy || '',
});

export const indexedTeachingNotesApi = {
  async list({ courseId } = {}) {
    const response = await request(`${BASE}${query({ courseId })}`);
    return asArray(response, 'items', 'content').map(normalizeApprovedRagIndex);
  },

  async update(id, payload) {
    return normalizeApprovedRagIndex(await request(`${BASE}/${encodePath(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
  },

  async remove(id) {
    return request(`${BASE}/${encodePath(id)}`, { method: 'DELETE' });
  },
};

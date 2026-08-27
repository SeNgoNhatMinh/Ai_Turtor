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

const normalizeIndexedKnowledge = (item = {}) => ({
  id: item.id || item._id || '',
  courseId: item.courseId || '',
  classId: item.classId || '',
  question: item.question || '',
  goldAnswer: item.goldAnswer || item.answer || '',
  answer: item.answer || item.goldAnswer || '',
  content: item.content || '',
  status: String(item.status || '').toUpperCase(),
  materialId: item.materialId || '',
  sourceType: item.sourceType || '',
  candidateType: item.candidateType || '',
  chapter: item.chapter || item.candidateType || 'Kiến thức Senior duyệt',
  authorId: item.authorId || item.teacherId || '',
  reviewedBy: item.reviewedBy || '',
  reviewerName: item.reviewerName || '',
  indexedAt: item.indexedAt || null,
  updatedAt: item.updatedAt || null,
});

export const indexedTeachingNotesApi = {
  async list({ courseId, status } = {}) {
    const response = await request(`${BASE}${query({ courseId, status })}`);
    return asArray(response, 'items', 'content').map(normalizeIndexedKnowledge);
  },

  async update(id, payload) {
    return normalizeIndexedKnowledge(await request(`${BASE}/${encodePath(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
  },

  async reindex(id) {
    return normalizeIndexedKnowledge(await request(`${BASE}/${encodePath(id)}/reindex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }));
  },

  async unindex(id) {
    return normalizeIndexedKnowledge(await request(`${BASE}/${encodePath(id)}/unindex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }));
  },

  async remove(id) {
    return request(`${BASE}/${encodePath(id)}`, { method: 'DELETE' });
  },
};

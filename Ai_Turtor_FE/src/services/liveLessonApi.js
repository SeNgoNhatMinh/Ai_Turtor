import { API_BASE_URL, API_TIMEOUTS, request } from './apiClient';

const json = (method, url, body, extra = {}) => request(url, {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body == null ? undefined : JSON.stringify(body),
  ...extra,
});

export const liveLessonApi = {
  list(params = {}) {
    const search = new URLSearchParams();
    if (params.courseId) search.set('courseId', params.courseId);
    if (params.classId) search.set('classId', params.classId);
    const query = search.toString();
    return request(`${API_BASE_URL}/live-lessons${query ? `?${query}` : ''}`);
  },

  get(lessonId) {
    return request(`${API_BASE_URL}/live-lessons/${encodeURIComponent(lessonId)}`);
  },

  create(payload, teacherName) {
    const search = teacherName ? `?teacherName=${encodeURIComponent(teacherName)}` : '';
    return json('POST', `${API_BASE_URL}/live-lessons${search}`, payload);
  },

  update(lessonId, payload) {
    return json('PUT', `${API_BASE_URL}/live-lessons/${encodeURIComponent(lessonId)}`, payload);
  },

  remove(lessonId) {
    return request(`${API_BASE_URL}/live-lessons/${encodeURIComponent(lessonId)}`, { method: 'DELETE' });
  },

  startPlayback(lessonId) {
    return json('POST', `${API_BASE_URL}/live-lessons/${encodeURIComponent(lessonId)}/open`);
  },

  end(lessonId) {
    return json('POST', `${API_BASE_URL}/live-lessons/${encodeURIComponent(lessonId)}/end`);
  },

  listChat(lessonId) {
    return request(`${API_BASE_URL}/live-lessons/${encodeURIComponent(lessonId)}/chat`);
  },

  sendChat(lessonId, content, senderName) {
    return json('POST', `${API_BASE_URL}/live-lessons/${encodeURIComponent(lessonId)}/chat`, {
      content,
      senderName,
    });
  },

  askAi(lessonId, question, videoTimestamp) {
    return json('POST', `${API_BASE_URL}/live-lessons/${encodeURIComponent(lessonId)}/ask-ai`, {
      question,
      videoTimestamp,
    }, { timeoutMs: API_TIMEOUTS.ai });
  },
};

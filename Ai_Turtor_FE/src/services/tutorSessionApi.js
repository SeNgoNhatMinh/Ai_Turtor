import { API_BASE_URL, API_TIMEOUTS, request } from './apiClient';

const jsonRequest = (url, method, body, options = {}) => request(url, {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
  timeoutMs: API_TIMEOUTS.ai,
  signal: options.signal,
  skipUnauthorizedRedirect: options.skipUnauthorizedRedirect,
});

export const tutorSessionApi = {
  openSession(payload, options = {}) {
    return jsonRequest(`${API_BASE_URL}/tutor/sessions/open`, 'POST', payload, options);
  },

  updateSession(sessionId, payload, options = {}) {
    return jsonRequest(`${API_BASE_URL}/tutor/sessions/${encodeURIComponent(sessionId)}`, 'PATCH', payload, options);
  },

  closeSession(sessionId, options = {}) {
    return jsonRequest(`${API_BASE_URL}/tutor/sessions/${encodeURIComponent(sessionId)}/close`, 'POST', {}, options);
  },

  listStudentSessions(studentId, courseId) {
    return request(
      `${API_BASE_URL}/tutor/students/${encodeURIComponent(studentId)}/courses/${encodeURIComponent(courseId)}/sessions`,
    );
  },

  listTeacherSummaries(teacherId, courseId, classId, options = {}) {
    return request(
      `${API_BASE_URL}/tutor/teachers/${encodeURIComponent(teacherId)}/courses/${encodeURIComponent(courseId)}`
      + `/classes/${encodeURIComponent(classId)}/session-summaries`,
      { signal: options.signal },
    );
  },

  listTeacherSessions(teacherId, courseId, classId, options = {}) {
    return request(
      `${API_BASE_URL}/tutor/teachers/${encodeURIComponent(teacherId)}/courses/${encodeURIComponent(courseId)}`
      + `/classes/${encodeURIComponent(classId)}/sessions`,
      { signal: options.signal },
    );
  },

  getTranscript(teacherId, summaryId, options = {}) {
    return request(
      `${API_BASE_URL}/tutor/teachers/${encodeURIComponent(teacherId)}`
      + `/session-summaries/${encodeURIComponent(summaryId)}/transcript`,
      { signal: options.signal },
    );
  },

  getSessionTranscript(teacherId, sessionId, options = {}) {
    return request(
      `${API_BASE_URL}/tutor/teachers/${encodeURIComponent(teacherId)}`
      + `/sessions/${encodeURIComponent(sessionId)}/transcript`,
      { signal: options.signal },
    );
  },

  listDirectives(teacherId, courseId, classId, options = {}) {
    return request(
      `${API_BASE_URL}/tutor/teachers/${encodeURIComponent(teacherId)}/courses/${encodeURIComponent(courseId)}`
      + `/classes/${encodeURIComponent(classId)}/directives`,
      { signal: options.signal },
    );
  },

  createDirective(teacherId, payload) {
    return jsonRequest(
      `${API_BASE_URL}/tutor/teachers/${encodeURIComponent(teacherId)}/directives`,
      'POST',
      payload,
    );
  },

  confirmDirective(teacherId, directiveId) {
    return jsonRequest(
      `${API_BASE_URL}/tutor/teachers/${encodeURIComponent(teacherId)}`
      + `/directives/${encodeURIComponent(directiveId)}/confirm`,
      'POST',
      {},
    );
  },

  archiveDirective(teacherId, directiveId) {
    return jsonRequest(
      `${API_BASE_URL}/tutor/teachers/${encodeURIComponent(teacherId)}`
      + `/directives/${encodeURIComponent(directiveId)}/archive`,
      'POST',
      {},
    );
  },
};

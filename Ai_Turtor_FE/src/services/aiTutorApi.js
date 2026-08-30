import { API_BASE_URL, API_TIMEOUTS, request } from './apiClient';
import { getAiMarkdownContent } from '../utils/aiResponseContent.js';
import {
  validateChatInput,
  validateOptionalCodeInput,
  validateCodeMentorRequest,
} from '../utils/validators';

const invalidRequest = (message) => Object.assign(new Error(message), {
  status: 400,
  userMessage: message,
});

const requireValidTutorPayload = (payload = {}) => {
  const question = payload.message || payload.question || '';
  const questionValidation = validateChatInput(question);
  if (!questionValidation.ok) throw invalidRequest(questionValidation.message);
  const codeValidation = validateOptionalCodeInput(payload.codeSnippet ?? payload.code);
  if (!codeValidation.ok) throw invalidRequest(codeValidation.message);
};

const normalizeAiQueryResponse = (response) => {
  if (!response || typeof response !== 'object') {
    return { answer: getAiMarkdownContent(response) };
  }

  return {
    ...response,
    answer: getAiMarkdownContent(response),
  };
};

export const aiTutorApi = {
  async sendQuery(payload, userId, userName = '', userEmail = '', options = {}) {
    requireValidTutorPayload(payload);
    const params = new URLSearchParams({ userId });
    if (userName) params.append('userName', userName);
    if (userEmail) params.append('userEmail', userEmail);
    const response = await request(`${API_BASE_URL}/ai/query?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: API_TIMEOUTS.ai,
      signal: options.signal,
    });
    return normalizeAiQueryResponse(response);
  },

  async getQuestionQuota(studentId, courseId) {
    const safeStudentId = encodeURIComponent(String(studentId || '').trim());
    const safeCourseId = encodeURIComponent(String(courseId || '').trim());
    return request(`${API_BASE_URL}/tutor/students/${safeStudentId}/courses/${safeCourseId}/question-quota`);
  },

  async reviewCode(payload) {
    const validation = validateCodeMentorRequest(payload);
    if (!validation.ok) throw invalidRequest(validation.message);
    return request(`${API_BASE_URL}/code-mentor/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validation.value),
      timeoutMs: API_TIMEOUTS.ai,
    });
  },
};

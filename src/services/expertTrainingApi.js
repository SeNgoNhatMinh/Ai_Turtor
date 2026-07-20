import { API_BASE_URL, API_TIMEOUTS, request } from './apiClient';
import { encodePath } from '../config/env';
import { asArray } from './normalizers';
import {
  normalizeCoverageGap,
  normalizeEvalRun,
  normalizeExpertTask,
  normalizeGoldQa,
  normalizeRubric,
} from './expertTrainingNormalizers';

const BASE_PATH = `${API_BASE_URL}/v2/expert-training`;

const createQuery = (values = {}) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const expertTrainingApi = {
  async analyzeCoverage(payload) {
    const response = await request(`${BASE_PATH}/coverage/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: API_TIMEOUTS.ai,
    });
    return asArray(response, 'gaps', 'content').map(normalizeCoverageGap);
  },

  async getCoverageGaps(courseId, options = {}) {
    const response = await request(
      `${BASE_PATH}/coverage-gaps${createQuery({ courseId })}`,
      { signal: options.signal },
    );
    return asArray(response, 'gaps', 'content').map(normalizeCoverageGap);
  },

  async createTask(payload) {
    return normalizeExpertTask(await request(`${BASE_PATH}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
  },

  async getTasks(filters = {}, options = {}) {
    const response = await request(`${BASE_PATH}/tasks${createQuery(filters)}`, {
      signal: options.signal,
    });
    return asArray(response, 'tasks', 'content').map(normalizeExpertTask);
  },

  async assignTask(taskId, payload) {
    return normalizeExpertTask(await request(`${BASE_PATH}/tasks/${encodePath(taskId)}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
  },

  async submitGoldQa(payload) {
    return normalizeGoldQa(await request(`${BASE_PATH}/gold-qa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: API_TIMEOUTS.ai,
    }));
  },

  async getGoldQa(courseId, filters = {}, options = {}) {
    const response = await request(`${BASE_PATH}/gold-qa${createQuery({ courseId, ...filters })}`, {
      signal: options.signal,
    });
    return asArray(response, 'items', 'content').map(normalizeGoldQa);
  },

  async reviewGoldQa(itemId, decision, payload) {
    const action = decision === 'approve' ? 'approve' : 'reject';
    return normalizeGoldQa(await request(`${BASE_PATH}/gold-qa/${encodePath(itemId)}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: API_TIMEOUTS.ai,
    }));
  },

  async submitRubric(payload) {
    return normalizeRubric(await request(`${BASE_PATH}/rubrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
  },

  async getRubrics(courseId, options = {}) {
    const response = await request(`${BASE_PATH}/rubrics${createQuery({ courseId })}`, {
      signal: options.signal,
    });
    return asArray(response, 'items', 'content').map(normalizeRubric);
  },

  async reviewRubric(itemId, decision, payload) {
    const action = decision === 'approve' ? 'approve' : 'reject';
    return normalizeRubric(await request(`${BASE_PATH}/rubrics/${encodePath(itemId)}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }));
  },

  async startEvaluation(payload) {
    return normalizeEvalRun(await request(`${BASE_PATH}/eval-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: API_TIMEOUTS.quizGeneration,
    }));
  },

  async getEvaluationRuns(courseId, options = {}) {
    const response = await request(`${BASE_PATH}/eval-runs${createQuery({ courseId })}`, {
      signal: options.signal,
    });
    return asArray(response, 'runs', 'content').map(normalizeEvalRun);
  },

  async getEvaluationRun(runId, options = {}) {
    return request(`${BASE_PATH}/eval-runs/${encodePath(runId)}`, {
      signal: options.signal,
    });
  },
};

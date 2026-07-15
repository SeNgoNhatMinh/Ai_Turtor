import { API_BASE_URL, request } from './apiClient';
import { encodePath } from '../config/env';

const toQueryString = (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

export const diagnosticsApi = {
  async getAdminStats() {
    return request(`${API_BASE_URL}/admin/dashboard/stats`);
  },

  async runLlmDiagnostics() {
    const data = await request(`${API_BASE_URL}/health/llm-diagnostics`);
    return data?.diagnostics ?? data;
  },

  async getHarnessLogs(filters = {}) {
    return request(`${API_BASE_URL}/harness/logs${toQueryString(filters)}`);
  },

  async getHarnessErrorLogs(filters = {}) {
    return request(`${API_BASE_URL}/harness/error-logs${toQueryString(filters)}`);
  },

  async getTraceLogs(traceId) {
    return request(`${API_BASE_URL}/harness/traces/${encodePath(traceId)}`);
  },
};

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
  async getAdminStats(options = {}) {
    return request(`${API_BASE_URL}/admin/dashboard/stats`, { signal: options.signal });
  },

  async runLlmDiagnostics(options = {}) {
    const data = await request(`${API_BASE_URL}/health/llm-diagnostics`, {
      signal: options.signal,
    });
    return data?.diagnostics ?? data;
  },

  async getHarnessLogs(filters = {}, options = {}) {
    return request(`${API_BASE_URL}/harness/logs${toQueryString(filters)}`, {
      signal: options.signal,
    });
  },

  async getHarnessErrorLogs(filters = {}) {
    return request(`${API_BASE_URL}/harness/error-logs${toQueryString(filters)}`);
  },

  async getTraceLogs(traceId, options = {}) {
    return request(`${API_BASE_URL}/harness/traces/${encodePath(traceId)}`, {
      signal: options.signal,
    });
  },
};

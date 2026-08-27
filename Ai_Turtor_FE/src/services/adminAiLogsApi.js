import { API_BASE_URL, request } from './apiClient';
import { encodePath } from '../config/env';

function normalizeLlmProvider(provider = {}) {
  const providerId = String(provider.providerId || provider.id || provider.provider || '').trim();
  return {
    ...provider,
    providerId,
    family: String(provider.family || '').trim(),
    label: String(provider.label || providerId || 'LLM provider').trim(),
    envModel: String(provider.envModel || '').trim(),
    effectiveModel: String(provider.effectiveModel || provider.model || '').trim(),
    envEnabled: provider.envEnabled === true,
    effectiveEnabled: provider.effectiveEnabled === true,
    adminDeleted: provider.adminDeleted === true,
    adminEnabledOverride: typeof provider.adminEnabledOverride === 'boolean'
      ? provider.adminEnabledOverride
      : null,
    adminModelOverride: provider.adminModelOverride == null
      ? null
      : String(provider.adminModelOverride).trim(),
    apiKeyConfigured: provider.apiKeyConfigured === true,
    baseUrl: String(provider.baseUrl || '').trim(),
    timeoutSeconds: Number(provider.timeoutSeconds) || 0,
    updatedAt: provider.updatedAt || null,
    updatedBy: String(provider.updatedBy || '').trim(),
  };
}

export function normalizeLlmProviders(data) {
  const providers = Array.isArray(data) ? data : data?.providers;
  return (Array.isArray(providers) ? providers : [])
    .map(normalizeLlmProvider)
    .filter((provider) => provider.providerId);
}

const jsonOptions = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const preserveAdminSession = { skipUnauthorizedRedirect: true };

export const adminAiLogsApi = {
  async getLogs(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') params.set(key, String(value));
    });
    const query = params.toString();
    return request(
      `${API_BASE_URL}/admin/ai-logs${query ? `?${query}` : ''}`,
      preserveAdminSession,
    );
  },
  async getProviderStats() {
    return request(`${API_BASE_URL}/admin/llm-providers/stats`, preserveAdminSession);
  },
  async getProviders() {
    const data = await request(`${API_BASE_URL}/admin/llm-providers`, preserveAdminSession);
    return normalizeLlmProviders(data);
  },
  async updateProvider(providerId, payload) {
    return request(`${API_BASE_URL}/admin/llm-providers/${encodePath(providerId)}`, {
      ...jsonOptions('PATCH', payload),
      ...preserveAdminSession,
    });
  },
  async enableProvider(providerId) {
    return request(`${API_BASE_URL}/admin/llm-providers/${encodePath(providerId)}/enable`, {
      method: 'POST',
      ...preserveAdminSession,
    });
  },
  async disableProvider(providerId) {
    return request(`${API_BASE_URL}/admin/llm-providers/${encodePath(providerId)}/disable`, {
      method: 'POST',
      ...preserveAdminSession,
    });
  },
  async deleteProvider(providerId) {
    return request(`${API_BASE_URL}/admin/llm-providers/${encodePath(providerId)}`, {
      method: 'DELETE',
      ...preserveAdminSession,
    });
  },
  async restoreProvider(providerId) {
    return request(`${API_BASE_URL}/admin/llm-providers/${encodePath(providerId)}/restore`, {
      method: 'POST',
      ...preserveAdminSession,
    });
  },
  async reloadProviders() {
    return request(`${API_BASE_URL}/admin/llm-providers/reload`, {
      method: 'POST',
      ...preserveAdminSession,
    });
  },
};

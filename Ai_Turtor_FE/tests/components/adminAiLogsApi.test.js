import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/apiClient', () => ({
  API_BASE_URL: '/api',
  request: vi.fn(),
}));

import { request } from '../../src/services/apiClient';
import {
  adminAiLogsApi,
  normalizeLlmProviders,
} from '../../src/services/adminAiLogsApi';

describe('adminAiLogsApi LLM provider management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    request.mockResolvedValue({});
  });

  it('normalizes the provider configuration response without inventing enabled state', () => {
    expect(normalizeLlmProviders({
      providers: [{
        providerId: 'groq-1',
        label: 'Groq 1',
        effectiveModel: 'llama-3',
        envEnabled: true,
        effectiveEnabled: false,
        adminEnabledOverride: null,
      }],
    })).toEqual([expect.objectContaining({
      providerId: 'groq-1',
      label: 'Groq 1',
      effectiveModel: 'llama-3',
      envEnabled: true,
      effectiveEnabled: false,
      adminEnabledOverride: null,
    })]);
  });

  it('uses the exact backend methods and paths for provider mutations', async () => {
    await adminAiLogsApi.updateProvider('groq 1', { enabled: true, model: 'llama-3' });
    expect(request).toHaveBeenLastCalledWith('/api/admin/llm-providers/groq%201', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ enabled: true, model: 'llama-3' }),
    }));

    await adminAiLogsApi.enableProvider('groq-1');
    expect(request).toHaveBeenLastCalledWith('/api/admin/llm-providers/groq-1/enable', expect.objectContaining({ method: 'POST' }));

    await adminAiLogsApi.disableProvider('groq-1');
    expect(request).toHaveBeenLastCalledWith('/api/admin/llm-providers/groq-1/disable', expect.objectContaining({ method: 'POST' }));

    await adminAiLogsApi.deleteProvider('groq-1');
    expect(request).toHaveBeenLastCalledWith('/api/admin/llm-providers/groq-1', expect.objectContaining({ method: 'DELETE' }));

    await adminAiLogsApi.restoreProvider('groq-1');
    expect(request).toHaveBeenLastCalledWith('/api/admin/llm-providers/groq-1/restore', expect.objectContaining({ method: 'POST' }));

    await adminAiLogsApi.reloadProviders();
    expect(request).toHaveBeenLastCalledWith('/api/admin/llm-providers/reload', expect.objectContaining({ method: 'POST' }));

    request.mock.calls.forEach(([, options]) => {
      expect(options?.skipUnauthorizedRedirect).toBe(true);
    });
  });

  it('lets canonical admin reads handle an expired session globally', async () => {
    await adminAiLogsApi.getLogs();
    expect(request).toHaveBeenLastCalledWith('/api/admin/ai-logs', expect.objectContaining({
      skipUnauthorizedRedirect: true,
    }));

    await adminAiLogsApi.getProviderStats();
    expect(request).toHaveBeenLastCalledWith('/api/admin/llm-providers/stats', expect.objectContaining({
      skipUnauthorizedRedirect: true,
    }));

    await adminAiLogsApi.getProviders();
    expect(request).toHaveBeenLastCalledWith('/api/admin/llm-providers', expect.objectContaining({
      skipUnauthorizedRedirect: true,
    }));
  });
});

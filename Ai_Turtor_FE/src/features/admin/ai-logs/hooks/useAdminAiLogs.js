import { useCallback, useEffect, useState } from 'react';
import { adminAiLogsApi } from '../../../../services/adminAiLogsApi';
import { getUserFacingError } from '../../../../services/apiClient';

const buildLogFilters = (values = {}) => {
  const range = Array.isArray(values.range) ? values.range : [];
  return {
    studentId: values.studentId,
    courseId: values.courseId,
    q: values.q,
    from: range[0]?.toISOString?.(),
    to: range[1]?.toISOString?.(),
  };
};

export function useAdminAiLogs() {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({});
  const [providerConfigs, setProviderConfigs] = useState([]);
  const [providerStats, setProviderStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [providerConfigLoading, setProviderConfigLoading] = useState(false);
  const [providerLoading, setProviderLoading] = useState(false);
  const [providerMutationKey, setProviderMutationKey] = useState('');
  const [providerError, setProviderError] = useState('');
  const [providerNotice, setProviderNotice] = useState('');
  const [error, setError] = useState('');

  const applyFilters = useCallback(async (values = {}) => {
    setLoading(true);
    setError('');
    try {
      const data = await adminAiLogsApi.getLogs(buildLogFilters(values));
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
      setSummary(data?.summary || {});
    } catch (reason) {
      setLogs([]);
      setSummary({});
      const permissionMessage = reason?.status === 401 || reason?.status === 403
        ? 'API nhật ký AI chưa chấp nhận quyền Admin hiện tại. Phiên đăng nhập của bạn vẫn được giữ nguyên.'
        : 'Không thể tải nhật ký hỏi đáp AI.';
      setError(
        reason?.status === 401 || reason?.status === 403
          ? permissionMessage
          : getUserFacingError(reason, permissionMessage),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProviderStats = useCallback(async () => {
    setProviderLoading(true);
    try {
      const data = await adminAiLogsApi.getProviderStats();
      setProviderStats(Array.isArray(data?.providers) ? data.providers : []);
    } catch (reason) {
      console.warn('Unable to load LLM provider stats:', reason);
      setProviderStats([]);
      setProviderError(
        reason?.status === 401 || reason?.status === 403
          ? 'API quản lý LLM provider chưa chấp nhận quyền Admin hiện tại. Phiên đăng nhập của bạn vẫn được giữ nguyên.'
          : getUserFacingError(reason, 'Không thể tải thống kê runtime của LLM provider.'),
      );
    } finally {
      setProviderLoading(false);
    }
  }, []);

  const loadProviderConfigs = useCallback(async () => {
    setProviderConfigLoading(true);
    try {
      setProviderConfigs(await adminAiLogsApi.getProviders());
    } catch (reason) {
      console.warn('Unable to load LLM provider configuration:', reason);
      setProviderError(
        reason?.status === 401 || reason?.status === 403
          ? 'API quản lý LLM provider chưa chấp nhận quyền Admin hiện tại. Phiên đăng nhập của bạn vẫn được giữ nguyên.'
          : getUserFacingError(reason, 'Không thể tải cấu hình LLM provider.'),
      );
    } finally {
      setProviderConfigLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setProviderError('');
    await Promise.all([applyFilters(), loadProviderConfigs(), loadProviderStats()]);
  }, [applyFilters, loadProviderConfigs, loadProviderStats]);

  const runProviderMutation = useCallback(async (mutationKey, action, successMessage) => {
    if (providerMutationKey) return false;
    setProviderMutationKey(mutationKey);
    setProviderError('');
    setProviderNotice('');
    try {
      await action();
      await Promise.all([loadProviderConfigs(), loadProviderStats()]);
      setProviderNotice(successMessage);
      return true;
    } catch (reason) {
      setProviderError(
        reason?.status === 401 || reason?.status === 403
          ? 'Bạn chưa được Backend cấp quyền quản lý LLM provider. Phiên đăng nhập vẫn được giữ nguyên.'
          : getUserFacingError(reason, 'Không thể cập nhật LLM provider.'),
      );
      return false;
    } finally {
      setProviderMutationKey('');
    }
  }, [loadProviderConfigs, loadProviderStats, providerMutationKey]);

  const updateProvider = useCallback((providerId, payload) => runProviderMutation(
    `update:${providerId}`,
    () => adminAiLogsApi.updateProvider(providerId, payload),
    'Đã lưu cấu hình provider và reload runtime chain.',
  ), [runProviderMutation]);

  const setProviderEnabled = useCallback((providerId, enabled) => runProviderMutation(
    `${enabled ? 'enable' : 'disable'}:${providerId}`,
    () => enabled
      ? adminAiLogsApi.enableProvider(providerId)
      : adminAiLogsApi.disableProvider(providerId),
    enabled ? 'Đã bật provider.' : 'Đã tắt provider.',
  ), [runProviderMutation]);

  const deleteProvider = useCallback((providerId) => runProviderMutation(
    `delete:${providerId}`,
    () => adminAiLogsApi.deleteProvider(providerId),
    'Đã xóa provider khỏi runtime chain. Có thể khôi phục khi cần.',
  ), [runProviderMutation]);

  const restoreProvider = useCallback((providerId) => runProviderMutation(
    `restore:${providerId}`,
    () => adminAiLogsApi.restoreProvider(providerId),
    'Đã khôi phục provider và reload runtime chain.',
  ), [runProviderMutation]);

  const reloadProviderChain = useCallback(() => runProviderMutation(
    'reload',
    () => adminAiLogsApi.reloadProviders(),
    'Đã reload LLM provider chain từ cấu hình hiện tại.',
  ), [runProviderMutation]);

  useEffect(() => {
    const timer = window.setTimeout(refreshAll, 0);
    return () => window.clearTimeout(timer);
  }, [refreshAll]);

  return {
    logs,
    summary,
    providerConfigs,
    providerStats,
    loading,
    providerConfigLoading,
    providerLoading,
    providerMutationKey,
    providerError,
    providerNotice,
    error,
    applyFilters,
    refreshAll,
    updateProvider,
    setProviderEnabled,
    deleteProvider,
    restoreProvider,
    reloadProviderChain,
  };
}

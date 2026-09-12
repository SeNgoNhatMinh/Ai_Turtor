import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../../app/queryKeys';
import { adminAiLogsApi } from '../../../../services/adminAiLogsApi';
import { getUserFacingError } from '../../../../services/apiClient';

const EMPTY_LIST = [];

const buildLogFilters = (values = {}) => {
  const range = Array.isArray(values.range) ? values.range : [];
  return {
    studentId: values.studentId || '',
    courseId: values.courseId || '',
    q: values.q || '',
    from: range[0]?.toISOString?.() || '',
    to: range[1]?.toISOString?.() || '',
  };
};

const providerErrorMessage = (reason, fallback) => (
  reason?.status === 401 || reason?.status === 403
    ? 'API quản lý LLM provider chưa chấp nhận quyền Admin hiện tại. Phiên đăng nhập của bạn vẫn được giữ nguyên.'
    : getUserFacingError(reason, fallback)
);

export function useAdminAiLogs() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(() => buildLogFilters());
  const [providerNotice, setProviderNotice] = useState('');
  const [providerMutationError, setProviderMutationError] = useState('');

  const logsQuery = useQuery({
    queryKey: queryKeys.adminAiLogs(filters),
    queryFn: ({ signal }) => adminAiLogsApi.getLogs(filters, { signal }),
    staleTime: 15_000,
  });
  const providerConfigsQuery = useQuery({
    queryKey: queryKeys.adminLlmProviders(),
    queryFn: ({ signal }) => adminAiLogsApi.getProviders({ signal }),
    staleTime: 30_000,
  });
  const providerStatsQuery = useQuery({
    queryKey: queryKeys.adminLlmProviderStats(),
    queryFn: ({ signal }) => adminAiLogsApi.getProviderStats({ signal }),
    staleTime: 15_000,
  });

  const providerMutation = useMutation({
    mutationFn: ({ action }) => action(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.adminLlmProviders() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminLlmProviderStats() }),
      ]);
    },
  });

  const applyFilters = useCallback(async (values = {}) => {
    const nextFilters = buildLogFilters(values);
    if (JSON.stringify(nextFilters) === JSON.stringify(filters)) {
      await logsQuery.refetch();
      return;
    }
    setFilters(nextFilters);
  }, [filters, logsQuery]);

  const refreshAll = useCallback(async () => {
    setProviderMutationError('');
    const emptyFilters = buildLogFilters();
    const tasks = [
      queryClient.invalidateQueries({ queryKey: queryKeys.adminLlmProviders() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.adminLlmProviderStats() }),
    ];
    if (JSON.stringify(filters) === JSON.stringify(emptyFilters)) {
      tasks.push(logsQuery.refetch());
    } else {
      setFilters(emptyFilters);
    }
    await Promise.all(tasks);
  }, [filters, logsQuery, queryClient]);

  const runProviderMutation = useCallback(async (mutationKey, action, successMessage) => {
    if (providerMutation.isPending) return false;
    setProviderMutationError('');
    setProviderNotice('');
    try {
      await providerMutation.mutateAsync({ mutationKey, action });
      setProviderNotice(successMessage);
      return true;
    } catch (reason) {
      setProviderMutationError(providerErrorMessage(reason, 'Không thể cập nhật LLM provider.'));
      return false;
    }
  }, [providerMutation]);

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

  const logsPayload = logsQuery.data || {};
  const logPermissionMessage = logsQuery.error?.status === 401 || logsQuery.error?.status === 403
    ? 'API nhật ký AI chưa chấp nhận quyền Admin hiện tại. Phiên đăng nhập của bạn vẫn được giữ nguyên.'
    : 'Không thể tải nhật ký hỏi đáp AI.';
  const providerQueryError = providerConfigsQuery.error || providerStatsQuery.error;

  return {
    logs: Array.isArray(logsPayload.logs) ? logsPayload.logs : EMPTY_LIST,
    summary: logsPayload.summary || {},
    providerConfigs: providerConfigsQuery.data || EMPTY_LIST,
    providerStats: Array.isArray(providerStatsQuery.data?.providers)
      ? providerStatsQuery.data.providers
      : EMPTY_LIST,
    loading: logsQuery.isPending || logsQuery.isFetching,
    providerConfigLoading: providerConfigsQuery.isPending || providerConfigsQuery.isFetching,
    providerLoading: providerStatsQuery.isPending || providerStatsQuery.isFetching,
    providerMutationKey: providerMutation.isPending
      ? providerMutation.variables?.mutationKey || ''
      : '',
    providerError: providerMutationError || (providerQueryError
      ? providerErrorMessage(providerQueryError, 'Không thể tải thông tin LLM provider.')
      : ''),
    providerNotice,
    error: logsQuery.error
      ? (logsQuery.error.status === 401 || logsQuery.error.status === 403
        ? logPermissionMessage
        : getUserFacingError(logsQuery.error, logPermissionMessage))
      : '',
    applyFilters,
    refreshAll,
    updateProvider,
    setProviderEnabled,
    deleteProvider,
    restoreProvider,
    reloadProviderChain,
  };
}

import { useCallback, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../app/queryKeys';
import { diagnosticsApi } from '../../../services/diagnosticsApi';
import { adminAcademicApi } from '../../../services/adminAcademicApi';
import { getUserFacingError } from '../../../services/apiClient';

export function useAdminDashboardController({ triggerToast }) {
  const statsQuery = useQuery({
    queryKey: queryKeys.adminDashboardStats(),
    queryFn: async ({ signal }) => {
      const [stats, courses] = await Promise.all([
        diagnosticsApi.getAdminStats({ signal }),
        adminAcademicApi.getCourses({ signal }),
      ]);
      return { ...(stats || {}), courses: Array.isArray(courses) ? courses.length : 0 };
    },
    staleTime: 30_000,
  });

  const diagnosticsMutation = useMutation({
    mutationFn: () => diagnosticsApi.runLlmDiagnostics(),
  });

  useEffect(() => {
    if (!statsQuery.error) return;
    triggerToast?.(getUserFacingError(statsQuery.error, 'Không thể tải số liệu tổng quan.'));
  }, [statsQuery.error, triggerToast]);

  const loadAdminStats = useCallback(() => statsQuery.refetch(), [statsQuery]);

  const runDiagnostics = useCallback(async () => {
    if (diagnosticsMutation.isPending) return;
    triggerToast?.('Đang kiểm tra kết nối hệ thống...');
    try {
      await diagnosticsMutation.mutateAsync();
      triggerToast?.('Đã hoàn tất kiểm tra hệ thống.');
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể chạy kiểm tra hệ thống.'));
    }
  }, [diagnosticsMutation, triggerToast]);

  return {
    adminStats: statsQuery.data || {},
    diagnosticsOutput: diagnosticsMutation.data || null,
    isDiagnosticsRunning: diagnosticsMutation.isPending,
    statsLoading: statsQuery.isPending || statsQuery.isFetching,
    statsError: statsQuery.error,
    loadAdminStats,
    runDiagnostics,
  };
}

import { useCallback, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../app/queryKeys';
import { diagnosticsApi } from '../../../services/diagnosticsApi';
import { adminAcademicApi } from '../../../services/adminAcademicApi';
import { getUserFacingError } from '../../../services/apiClient';
import { useRealtimeEvent, useRealtimeReconnect } from '../../realtime/realtimeContext';
import { REALTIME_EVENT_TYPES } from '../../realtime/realtimeEvents';

export function useAdminDashboardController({ triggerToast }) {
  const statsQuery = useQuery({
    queryKey: queryKeys.adminDashboardStats(),
    queryFn: async ({ signal }) => {
      const stats = await diagnosticsApi.getAdminStats({ signal });
      if (Number.isFinite(Number(stats?.academic?.courses))) return stats || {};
      const courses = await adminAcademicApi.getCourses({ signal });
      return { ...(stats || {}), courses: Array.isArray(courses) ? courses.length : 0 };
    },
    staleTime: 30_000,
  });

  const diagnosticsMutation = useMutation({
    mutationFn: () => diagnosticsApi.runLlmDiagnostics(),
  });

  useEffect(() => {
    if (!statsQuery.error) return;
    triggerToast?.(getUserFacingError(statsQuery.error, 'Không thể tải số liệu tổng quan.'), 'error');
  }, [statsQuery.error, triggerToast]);

  const loadAdminStats = useCallback(() => statsQuery.refetch(), [statsQuery]);

  useRealtimeEvent([
    ...REALTIME_EVENT_TYPES.adminUser,
    ...REALTIME_EVENT_TYPES.academicEntity,
    ...REALTIME_EVENT_TYPES.material,
  ], loadAdminStats);
  useRealtimeReconnect(loadAdminStats);

  const runDiagnostics = useCallback(async () => {
    if (diagnosticsMutation.isPending) return;
    triggerToast?.('Đang kiểm tra kết nối hệ thống...');
    try {
      await diagnosticsMutation.mutateAsync();
      triggerToast?.('Đã hoàn tất kiểm tra hệ thống.');
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể chạy kiểm tra hệ thống.'), 'error');
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

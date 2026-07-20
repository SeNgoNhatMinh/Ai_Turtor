import { useCallback, useState } from 'react';
import { diagnosticsApi } from '../../../services/diagnosticsApi';
import { getUserFacingError } from '../../../services/apiClient';

export function useAdminDashboardController({ triggerToast }) {
  const [adminStats, setAdminStats] = useState({});
  const [diagnosticsOutput, setDiagnosticsOutput] = useState(null);
  const [isDiagnosticsRunning, setIsDiagnosticsRunning] = useState(false);

  const loadAdminStats = useCallback(async () => {
    try {
      const stats = await diagnosticsApi.getAdminStats();
      setAdminStats(stats || {});
    } catch (error) {
      setAdminStats({});
      triggerToast?.(getUserFacingError(error, 'Không thể tải số liệu tổng quan.'));
    }
  }, [triggerToast]);

  const runDiagnostics = async () => {
    if (isDiagnosticsRunning) return;
    setIsDiagnosticsRunning(true);
    triggerToast?.('Đang kiểm tra kết nối hệ thống...');
    try {
      const diagnostics = await diagnosticsApi.runLlmDiagnostics();
      setDiagnosticsOutput(diagnostics);
      triggerToast?.('Đã hoàn tất kiểm tra hệ thống.');
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể chạy kiểm tra hệ thống.'));
    } finally {
      setIsDiagnosticsRunning(false);
    }
  };

  return {
    adminStats,
    diagnosticsOutput,
    isDiagnosticsRunning,
    loadAdminStats,
    runDiagnostics,
  };
}

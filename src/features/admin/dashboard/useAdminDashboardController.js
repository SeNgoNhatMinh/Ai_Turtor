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
      triggerToast?.(getUserFacingError(error, 'Unable to load admin dashboard statistics.'));
    }
  }, [triggerToast]);

  const runDiagnostics = async () => {
    if (isDiagnosticsRunning) return;
    setIsDiagnosticsRunning(true);
    triggerToast?.('Checking system connectivity...');
    try {
      const diagnostics = await diagnosticsApi.runLlmDiagnostics();
      setDiagnosticsOutput(diagnostics);
      triggerToast?.('System diagnostics completed.');
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Unable to run diagnostics.'));
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

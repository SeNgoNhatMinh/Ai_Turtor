import { useState } from 'react';
import { adminUsersApi } from '../services/adminUsersApi';
import { diagnosticsApi } from '../services/diagnosticsApi';
import { getUserFacingError } from '../services/apiClient';

export function useAdminRuntimeController({ triggerToast }) {
  const [adminStats, setAdminStats] = useState({});
  const [diagnosticsOutput, setDiagnosticsOutput] = useState(null);
  const [isDiagnosticsRunning, setIsDiagnosticsRunning] = useState(false);

  const loadAdminStats = async () => {
    const stats = await diagnosticsApi.getAdminStats();
    setAdminStats(stats);
  };

  const runDiagnostics = async () => {
    setIsDiagnosticsRunning(true);
    triggerToast('Checking system connectivity...');

    try {
      const diag = await diagnosticsApi.runLlmDiagnostics();
      setDiagnosticsOutput(diag);
      triggerToast('System diagnostics completed.');
    } catch (error) {
      console.error('Error running diagnostics:', error);
      triggerToast(getUserFacingError(error, 'Unable to run diagnostics.'));
    } finally {
      setIsDiagnosticsRunning(false);
    }
  };

  const handleAdminImport = async (file) => {
    triggerToast('Importing mentors from Excel...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await adminUsersApi.importMentors(formData);
      triggerToast('Mentor import completed.');
      return res.log;
    } catch (error) {
      console.error('Error importing mentors:', error);
      triggerToast(getUserFacingError(error, 'Unable to import mentors.'));
      return null;
    }
  };

  return {
    adminStats,
    diagnosticsOutput,
    isDiagnosticsRunning,
    loadAdminStats,
    runDiagnostics,
    handleAdminImport,
  };
}

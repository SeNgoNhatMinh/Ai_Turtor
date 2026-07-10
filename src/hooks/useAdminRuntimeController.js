import { useState } from 'react';
import { apiService } from '../services/api';
import { getUserFacingError } from '../services/apiClient';

export function useAdminRuntimeController({ triggerToast }) {
  const [adminStats, setAdminStats] = useState({});
  const [diagnosticsOutput, setDiagnosticsOutput] = useState(null);
  const [isDiagnosticsRunning, setIsDiagnosticsRunning] = useState(false);
  const [adminPlans, setAdminPlans] = useState([]);

  const loadAdminStats = async () => {
    const stats = await apiService.getAdminStats();
    setAdminStats(stats);
  };

  const loadSubscriptionPlans = async () => {
    const plans = await apiService.getSubscriptionPlans();
    setAdminPlans(Array.isArray(plans) ? plans : []);
  };

  const runDiagnostics = async () => {
    setIsDiagnosticsRunning(true);
    triggerToast('Checking system connectivity...');

    try {
      const diag = await apiService.runDiagnostics();
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
      const res = await apiService.importMentors(formData);
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
    adminPlans,
    loadAdminStats,
    loadSubscriptionPlans,
    runDiagnostics,
    handleAdminImport,
  };
}

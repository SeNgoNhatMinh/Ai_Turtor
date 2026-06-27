import { useState, useCallback } from 'react';
import { apiService } from '../../../services/api';
import { useAuthStore } from '../../../app/store/authStore';
import { useUiStore } from '../../../app/store/uiStore';
import { getUserFacingError } from '../../../services/apiClient';

export function useAdmin() {
  const currentUser = useAuthStore(state => state.currentUser);
  const triggerToast = useUiStore(state => state.setToastMessage);

  const [adminStats, setAdminStats] = useState({});
  const [adminPlans, setAdminPlans] = useState([]);
  const [diagnosticsOutput, setDiagnosticsOutput] = useState(null);
  const [isDiagnosticsRunning, setIsDiagnosticsRunning] = useState(false);

  const loadAdminStats = useCallback(async () => {
    try {
      const stats = await apiService.getAdminStats();
      setAdminStats(stats);
    } catch (e) {
      console.warn('Failed to load admin stats:', e);
      setAdminStats({});
    }
  }, []);

  const loadSubscriptionPlans = useCallback(async () => {
    try {
      const plans = await apiService.getSubscriptionPlans();
      setAdminPlans(plans || []);
    } catch (e) {
      console.warn('Failed to load plans:', e);
    }
  }, []);

  const handleAdminImport = useCallback(async (file) => {
    try {
      await apiService.importUsers(file);
      triggerToast('Import successful.');
      loadAdminStats();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Import failed.'));
    }
  }, [loadAdminStats, triggerToast]);

  return {
    adminStats,
    adminPlans,
    diagnosticsOutput,
    isDiagnosticsRunning,
    setDiagnosticsOutput,
    setIsDiagnosticsRunning,
    loadAdminStats,
    loadSubscriptionPlans,
    handleAdminImport
  };
}

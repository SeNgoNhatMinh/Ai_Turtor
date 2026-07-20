import { useCallback, useEffect, useState } from 'react';
import { getUserFacingError } from '../../../services/apiClient';
import { studentLearningApi } from '../../../services/studentLearningApi';

export function useImprovePlans({ studentId, courseId, triggerToast, onRefreshDashboard }) {
  const [improvePlans, setImprovePlans] = useState([]);
  const [latestPlan, setLatestPlan] = useState(null);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [plansError, setPlansError] = useState('');
  const [completingPlanId, setCompletingPlanId] = useState('');
  const hasContext = Boolean(studentId && courseId);

  const fetchImprovePlans = useCallback(async () => {
    if (!hasContext) {
      setImprovePlans([]);
      setLatestPlan(null);
      setPlansError('');
      return;
    }

    setLoadingPlans(true);
    setPlansError('');
    try {
      const [plans, latest] = await Promise.all([
        studentLearningApi.getImprovePlans(studentId, courseId),
        studentLearningApi.getLatestImprovePlan(studentId, courseId),
      ]);
      setImprovePlans(Array.isArray(plans) ? plans : []);
      setLatestPlan(latest || null);
    } catch (error) {
      const message = getUserFacingError(error, 'Không thể tải kế hoạch cải thiện.');
      setPlansError(message);
      triggerToast?.(message);
    } finally {
      setLoadingPlans(false);
    }
  }, [courseId, hasContext, studentId, triggerToast]);

  useEffect(() => {
    const loadTimer = window.setTimeout(fetchImprovePlans, 0);
    return () => window.clearTimeout(loadTimer);
  }, [fetchImprovePlans]);

  const completePlan = useCallback(async (planId) => {
    if (!planId || completingPlanId) return false;
    setCompletingPlanId(planId);
    try {
      await studentLearningApi.completeImprovePlan(planId);
      triggerToast?.('Đã hoàn thành kế hoạch cải thiện.');
      await fetchImprovePlans();
      onRefreshDashboard?.();
      return true;
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể hoàn thành kế hoạch cải thiện này.'));
      return false;
    } finally {
      setCompletingPlanId('');
    }
  }, [completingPlanId, fetchImprovePlans, onRefreshDashboard, triggerToast]);

  return {
    completePlan,
    completingPlanId,
    fetchImprovePlans,
    improvePlans,
    latestPlan,
    loadingPlans,
    plansError,
  };
}

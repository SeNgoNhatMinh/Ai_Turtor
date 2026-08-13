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
  const [providerStats, setProviderStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [providerLoading, setProviderLoading] = useState(false);
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
      setError(getUserFacingError(reason, permissionMessage));
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
    } finally {
      setProviderLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([applyFilters(), loadProviderStats()]);
  }, [applyFilters, loadProviderStats]);

  useEffect(() => {
    const timer = window.setTimeout(refreshAll, 0);
    return () => window.clearTimeout(timer);
  }, [refreshAll]);

  return {
    logs,
    summary,
    providerStats,
    loading,
    providerLoading,
    error,
    applyFilters,
    refreshAll,
  };
}

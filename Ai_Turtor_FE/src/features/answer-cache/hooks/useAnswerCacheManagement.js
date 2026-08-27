import { useCallback, useEffect, useState } from 'react';
import { tutorAnswerCacheApi } from '../../../services/tutorAnswerCacheApi';
import { getUserFacingError } from '../../../services/apiClient';
import { normalizeAccountRole, ACCOUNT_ROLES } from '../../../constants/roles';

function buildReviewerPayload(currentUser, extra = {}) {
  const role = normalizeAccountRole(currentUser?.role, ACCOUNT_ROLES.SENIOR_MENTOR);
  return {
    seniorReviewerId: String(currentUser?.userId || currentUser?.id || '').trim(),
    seniorReviewerName: String(
      currentUser?.fullName || currentUser?.name || currentUser?.email || '',
    ).trim(),
    reviewerRole: role === ACCOUNT_ROLES.ADMIN ? 'ADMIN' : 'SENIOR_MENTOR',
    ...extra,
  };
}

function assertReviewerPayload(payload) {
  if (!String(payload?.seniorReviewerId || '').trim()) {
    throw Object.assign(new Error('Thiếu mã người duyệt. Vui lòng đăng nhập lại.'), { status: 400 });
  }
}

export function useAnswerCacheManagement({ currentUser, courseId, triggerToast }) {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [recentHits, setRecentHits] = useState([]);
  const [filters, setFilters] = useState({ mode: '', reviewStatus: '', classId: '' });
  const [loading, setLoading] = useState(false);
  const [mutationKey, setMutationKey] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadEntries = useCallback(async () => {
    const normalizedCourseId = String(courseId || '').trim();
    if (!normalizedCourseId) {
      setEntries([]);
      setStats(null);
      setDiagnostics(null);
      setRecentHits([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [list, statsData, diagnosticsData, hitsData] = await Promise.all([
        tutorAnswerCacheApi.list({
          courseId: normalizedCourseId,
          classId: filters.classId,
          mode: filters.mode,
          reviewStatus: filters.reviewStatus,
        }),
        tutorAnswerCacheApi.getStats(normalizedCourseId),
        tutorAnswerCacheApi.getDiagnostics(normalizedCourseId).catch(() => null),
        tutorAnswerCacheApi.getRecentHits(normalizedCourseId, 50).catch(() => null),
      ]);
      setEntries(list);
      setStats(statsData || null);
      setDiagnostics(diagnosticsData || null);
      setRecentHits(Array.isArray(hitsData) ? hitsData : (statsData?.recentHits || []));
    } catch (reason) {
      setEntries([]);
      setStats(null);
      setDiagnostics(null);
      setRecentHits([]);
      setError(
        reason?.status === 401 || reason?.status === 403
          ? 'API cache câu trả lời chưa chấp nhận quyền Senior/Admin hiện tại.'
          : getUserFacingError(reason, 'Không thể tải cache câu trả lời AI.'),
      );
    } finally {
      setLoading(false);
    }
  }, [courseId, filters.classId, filters.mode, filters.reviewStatus]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadEntries();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadEntries]);

  const runMutation = useCallback(async (key, action, successMessage) => {
    if (mutationKey) return false;
    setMutationKey(key);
    setError('');
    setNotice('');
    try {
      await action();
      await loadEntries();
      setNotice(successMessage);
      triggerToast?.(successMessage, 'success');
      return true;
    } catch (reason) {
      const message = getUserFacingError(reason, 'Thao tác cache thất bại.');
      setError(message);
      triggerToast?.(message, 'error');
      return false;
    } finally {
      setMutationKey('');
    }
  }, [loadEntries, mutationKey, triggerToast]);

  const reviewerPayload = useCallback((extra = {}) => {
    const payload = buildReviewerPayload(currentUser, extra);
    assertReviewerPayload(payload);
    return payload;
  }, [currentUser]);

  return {
    entries,
    stats,
    diagnostics,
    recentHits,
    filters,
    setFilters,
    loading,
    mutationKey,
    error,
    notice,
    setNotice,
    setError,
    refresh: loadEntries,
    approveEntry: (cacheId) => runMutation(
      `approve-${cacheId}`,
      () => tutorAnswerCacheApi.approve(cacheId, reviewerPayload()),
      'Đã duyệt cache câu trả lời.',
    ),
    correctEntry: (cacheId, correctedAnswer, notes) => runMutation(
      `correct-${cacheId}`,
      () => tutorAnswerCacheApi.correct(cacheId, reviewerPayload({
        correctedAnswer,
        notes,
      })),
      'Đã cập nhật câu trả lời trong cache.',
    ),
    disableEntry: (cacheId, notes) => runMutation(
      `disable-${cacheId}`,
      () => tutorAnswerCacheApi.disable(cacheId, reviewerPayload({ notes })),
      'Đã tắt cache — sinh viên sẽ không nhận lại câu trả lời này.',
    ),
    deleteEntry: (cacheId) => runMutation(
      `delete-${cacheId}`,
      () => tutorAnswerCacheApi.delete(cacheId, reviewerPayload()),
      'Đã xóa entry cache.',
    ),
  };
}

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../app/queryKeys';
import { ACCOUNT_ROLES, normalizeAccountRole } from '../../../constants/roles';
import { getUserFacingError } from '../../../services/apiClient';
import { tutorAnswerCacheApi } from '../../../services/tutorAnswerCacheApi';

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

const loadAnswerCache = async (courseId, filters) => {
  const [entries, stats, diagnostics, recentHits] = await Promise.all([
    tutorAnswerCacheApi.list({ courseId, ...filters }),
    tutorAnswerCacheApi.getStats(courseId),
    tutorAnswerCacheApi.getDiagnostics(courseId).catch(() => null),
    tutorAnswerCacheApi.getRecentHits(courseId, 50).catch(() => null),
  ]);
  return {
    entries,
    stats: stats || null,
    diagnostics: diagnostics || null,
    recentHits: Array.isArray(recentHits) ? recentHits : (stats?.recentHits || []),
  };
};

export function useAnswerCacheManagement({ currentUser, courseId, triggerToast }) {
  const queryClient = useQueryClient();
  const normalizedCourseId = String(courseId || '').trim();
  const [filters, setFilters] = useState({ mode: '', reviewStatus: '', classId: '' });
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const cacheQuery = useQuery({
    queryKey: queryKeys.answerCache(normalizedCourseId, filters),
    queryFn: () => loadAnswerCache(normalizedCourseId, filters),
    enabled: Boolean(normalizedCourseId),
    staleTime: 15_000,
  });

  const cacheMutation = useMutation({
    mutationFn: ({ action }) => action(),
  });

  const runMutation = useCallback(async (key, action, successMessage) => {
    if (cacheMutation.isPending) return false;
    setActionError('');
    setNotice('');
    try {
      await cacheMutation.mutateAsync({ key, action });
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'answer-cache', normalizedCourseId],
      });
      setNotice(successMessage);
      triggerToast?.(successMessage, 'success');
      return true;
    } catch (reason) {
      const message = getUserFacingError(reason, 'Thao tác cache thất bại.');
      setActionError(message);
      triggerToast?.(message, 'error');
      return false;
    }
  }, [
    cacheMutation,
    normalizedCourseId,
    queryClient,
    setActionError,
    setNotice,
    triggerToast,
  ]);

  const reviewerPayload = useCallback((extra = {}) => {
    const payload = buildReviewerPayload(currentUser, extra);
    assertReviewerPayload(payload);
    return payload;
  }, [currentUser]);

  const queryError = cacheQuery.error
    ? (cacheQuery.error?.status === 401 || cacheQuery.error?.status === 403
      ? 'API cache câu trả lời chưa chấp nhận quyền Senior/Admin hiện tại.'
      : getUserFacingError(cacheQuery.error, 'Không thể tải cache câu trả lời AI.'))
    : '';
  const data = cacheQuery.data || {};

  return {
    entries: data.entries || [],
    stats: data.stats || null,
    diagnostics: data.diagnostics || null,
    recentHits: data.recentHits || [],
    filters,
    setFilters,
    loading: cacheQuery.isPending,
    mutationKey: cacheMutation.isPending ? cacheMutation.variables?.key || '' : '',
    error: actionError || queryError,
    notice,
    setNotice,
    setError: setActionError,
    refresh: cacheQuery.refetch,
    approveEntry: (cacheId) => runMutation(
      `approve-${cacheId}`,
      () => tutorAnswerCacheApi.approve(cacheId, reviewerPayload()),
      'Đã duyệt cache câu trả lời.',
    ),
    correctEntry: (cacheId, correctedAnswer, notes) => runMutation(
      `correct-${cacheId}`,
      () => tutorAnswerCacheApi.correct(cacheId, reviewerPayload({ correctedAnswer, notes })),
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

import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../app/queryKeys';
import { getUserFacingError } from '../services/apiClient';
import { normalizeEscalation, normalizeEscalationDetailResponse } from '../services/normalizers';
import { supportChatApi } from '../services/supportChatApi';

const TERMINAL_ESCALATION_STATES = new Set([
  'ANSWERED',
  'ANSWERED_NO_KNOWLEDGE_CANDIDATE',
  'ANSWERED_KNOWLEDGE_REJECTED',
  'MENTOR_ANSWERED',
  'MENTOR_ANSWERED_PENDING_SENIOR_REVIEW',
  'COMPLETED',
  'CLOSED',
  'CANCELLED',
  'REJECTED',
  'RESOLVED',
  'RESOLVED_INDEXED',
  'AI_BRAIN_UPDATED',
]);

const normalizeStatus = (value) => String(value || '').trim().toUpperCase();
const sortNewestFirst = (items) => items.slice().sort(
  (a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0),
);

const loadEscalations = async (userId, signal) => {
  const data = await supportChatApi.getEscalationHistory(userId, { signal });
  return sortNewestFirst((Array.isArray(data) ? data : []).map(normalizeEscalation));
};

const loadEscalationDetail = async (escalationId, signal) => {
  const data = await supportChatApi.getEscalationDetail(escalationId, { signal });
  return normalizeEscalationDetailResponse(data);
};

export function useStudentSupport({ activeTab, userId, selectedEscalationId = null }) {
  const queryClient = useQueryClient();
  const resolvedUserId = String(userId || '').trim();
  const isActive = activeTab === 'student-escalation';

  const historyQuery = useQuery({
    queryKey: queryKeys.studentMentorRequests(resolvedUserId),
    queryFn: ({ signal }) => loadEscalations(resolvedUserId, signal),
    enabled: isActive && Boolean(resolvedUserId),
    staleTime: 30_000,
  });
  const escalations = useMemo(() => historyQuery.data || [], [historyQuery.data]);
  const effectiveSelectedId = selectedEscalationId ?? escalations[0]?.id ?? '';

  const selectedSummary = useMemo(
    () => escalations.find((item) => item.id === effectiveSelectedId) || null,
    [effectiveSelectedId, escalations],
  );
  const detailQuery = useQuery({
    queryKey: queryKeys.studentMentorRequestDetail(effectiveSelectedId),
    queryFn: ({ signal }) => loadEscalationDetail(effectiveSelectedId, signal),
    enabled: isActive && Boolean(resolvedUserId && effectiveSelectedId),
    staleTime: 10_000,
    refetchInterval: (query) => {
      const data = query.state.data || selectedSummary;
      const workflowStatus = normalizeStatus(data?.status);
      const visibleStatus = normalizeStatus(data?.studentVisibleStatus);
      return TERMINAL_ESCALATION_STATES.has(workflowStatus)
        || TERMINAL_ESCALATION_STATES.has(visibleStatus)
        ? false
        : 10_000;
    },
  });
  const selectedEscalation = selectedSummary || detailQuery.data
    ? { ...selectedSummary, ...(detailQuery.data || {}) }
    : null;

  useEffect(() => {
    const detail = detailQuery.data;
    if (!detail?.id || !resolvedUserId) return;
    queryClient.setQueryData(
      queryKeys.studentMentorRequests(resolvedUserId),
      (current = []) => current.map((item) => (
        item.id === detail.id ? { ...item, ...detail } : item
      )),
    );
  }, [detailQuery.data, queryClient, resolvedUserId]);

  const refetchHistory = historyQuery.refetch;
  const loadEscalationsNow = useCallback(async () => {
    if (!resolvedUserId) return [];
    const result = await refetchHistory();
    return result.data || [];
  }, [refetchHistory, resolvedUserId]);

  const handleEscalationChange = useCallback((nextEscalation) => {
    if (!nextEscalation?.id) return;
    queryClient.setQueryData(
      queryKeys.studentMentorRequestDetail(nextEscalation.id),
      (current) => ({ ...(current || {}), ...nextEscalation }),
    );
    queryClient.setQueryData(
      queryKeys.studentMentorRequests(resolvedUserId),
      (current = []) => current.map((item) => (
        item.id === nextEscalation.id ? { ...item, ...nextEscalation } : item
      )),
    );
  }, [queryClient, resolvedUserId]);

  return {
    escalations,
    selectedEscalation,
    isEscalationsLoading: historyQuery.isPending,
    isEscalationDetailLoading: detailQuery.isFetching && !detailQuery.data,
    escalationsError: historyQuery.error
      ? getUserFacingError(historyQuery.error, 'Không thể tải các yêu cầu hỗ trợ.')
      : '',
    escalationDetailError: detailQuery.error
      ? getUserFacingError(detailQuery.error, 'Không thể tải đầy đủ yêu cầu hỗ trợ này.')
      : '',
    loadEscalations: loadEscalationsNow,
    handleEscalationChange,
  };
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../app/queryKeys';
import { getUserFacingError } from '../../../services/apiClient';
import { n8nService } from '../../../services/n8nService';
import { N8N_ENABLED, N8N_STRICT } from '../../../services/n8nClient';
import { teacherReviewApi } from '../../../services/teacherReviewApi';
import { asArray, normalizeAnswerReview, normalizeGroupedAnswerReview, normalizeTeacherInboxItem } from '../../../services/normalizers';
import { normalizeAccountRole } from '../../../constants/roles';
import { canReviewKnowledge } from '../../../utils/permissions';
import { useRealtimeEvent, useRealtimeReconnect } from '../../realtime/realtimeContext';
import { eventMatchesCourse, REALTIME_EVENT_TYPES } from '../../realtime/realtimeEvents';

const EMPTY_LIST = [];
const PENDING_CANDIDATE_STATUS = 'PENDING_SENIOR_REVIEW';

const normalizeCandidateHistory = (items) => items
  .filter((candidate) => {
    const status = String(candidate?.status || '').trim().toUpperCase();
    return status && !['PENDING_SENIOR_REVIEW', 'PENDING_REVIEW'].includes(status);
  })
  .sort((left, right) => {
    const leftTime = new Date(left.reviewedAt || left.updatedAt || left.indexedAt || 0).getTime();
    const rightTime = new Date(right.reviewedAt || right.updatedAt || right.indexedAt || 0).getTime();
    return rightTime - leftTime;
  });

export function useTeacherReviewQueue({
  currentUser,
  teacherId,
  courseId,
  triggerToast,
  includeTeacherInbox = true,
}) {
  const queryClient = useQueryClient();
  const [inboxFilters, setInboxFilters] = useState({});
  const [selectedEscalationId, setSelectedEscalationId] = useState('');
  const [isTeacherAnswerSubmitting, setIsTeacherAnswerSubmitting] = useState(false);
  const [deletingEscalationIds, setDeletingEscalationIds] = useState([]);
  const deletingEscalationIdsRef = useRef(new Set());
  const [pendingCandidateActionIds, setPendingCandidateActionIds] = useState([]);
  const [pendingSeniorReviewIds, setPendingSeniorReviewIds] = useState([]);
  const reviewerName = currentUser?.fullName || currentUser?.name || 'Senior Mentor';
  const reviewerRole = normalizeAccountRole(currentUser?.originalRole || currentUser?.role);
  const isSeniorReviewer = canReviewKnowledge(reviewerRole);
  const queueRole = isSeniorReviewer ? 'senior' : 'mentor';
  const inboxQueryKey = queryKeys.teacherReviewInbox(teacherId, courseId, inboxFilters);
  const answerQueueQueryKey = queryKeys.teacherAnswerReviewQueue(teacherId, queueRole, courseId);
  const resolvedQueryKey = queryKeys.teacherResolvedAnswerReviews(teacherId, courseId);
  const candidatesQueryKey = queryKeys.teacherKnowledgeCandidates(
    teacherId,
    courseId,
    PENDING_CANDIDATE_STATUS,
  );
  const candidateHistoryQueryKey = queryKeys.teacherKnowledgeCandidates(teacherId, courseId, '');

  const inboxQuery = useQuery({
    queryKey: inboxQueryKey,
    queryFn: async ({ signal }) => {
      const params = { ...(courseId ? { courseId } : {}), ...inboxFilters };
      const data = await teacherReviewApi.getTeacherEscalations(teacherId, params, { signal });
      return asArray(data, 'escalations', 'inbox', 'content').map(normalizeTeacherInboxItem);
    },
    enabled: Boolean(includeTeacherInbox && teacherId),
    staleTime: 15_000,
  });
  const answerQueueQuery = useQuery({
    queryKey: answerQueueQueryKey,
    queryFn: async ({ signal }) => {
      const queue = isSeniorReviewer
        ? await teacherReviewApi.getSeniorPendingAnswerReviewQueue(courseId, { signal })
        : await teacherReviewApi.getMentorPendingAnswerReviewQueue(courseId, { signal });
      return {
        reviews: (queue.reviews || []).map(normalizeAnswerReview),
        groups: (queue.groups || []).map(normalizeGroupedAnswerReview),
      };
    },
    enabled: Boolean(teacherId),
    staleTime: 15_000,
  });
  const resolvedReviewsQuery = useQuery({
    queryKey: resolvedQueryKey,
    queryFn: async ({ signal }) => {
      const reviews = await teacherReviewApi.getAnswerReviews(
        { status: 'RESOLVED', courseId },
        { signal },
      );
      return reviews.map(normalizeAnswerReview);
    },
    enabled: Boolean(teacherId),
    staleTime: 30_000,
  });
  const candidatesQuery = useQuery({
    queryKey: candidatesQueryKey,
    queryFn: ({ signal }) => teacherReviewApi.getKnowledgeCandidates(
      PENDING_CANDIDATE_STATUS,
      courseId,
      { signal },
    ),
    enabled: Boolean(teacherId && isSeniorReviewer),
    staleTime: 15_000,
  });
  const candidateHistoryQuery = useQuery({
    queryKey: candidateHistoryQueryKey,
    queryFn: async ({ signal }) => normalizeCandidateHistory(
      await teacherReviewApi.getKnowledgeCandidates('', courseId, { signal }),
    ),
    enabled: Boolean(teacherId && isSeniorReviewer),
    staleTime: 30_000,
  });

  const escalations = includeTeacherInbox ? inboxQuery.data || EMPTY_LIST : EMPTY_LIST;
  const selectedEscalation = useMemo(() => (
    escalations.find((item) => item.id === selectedEscalationId) || escalations[0] || null
  ), [escalations, selectedEscalationId]);
  const setSelectedEscalation = useCallback((item) => {
    setSelectedEscalationId(item?.id || '');
  }, []);
  const queueReviews = answerQueueQuery.data?.reviews || EMPTY_LIST;
  const queueGroups = answerQueueQuery.data?.groups || EMPTY_LIST;
  const answerReviews = isSeniorReviewer ? EMPTY_LIST : queueReviews;
  const answerReviewGroups = isSeniorReviewer ? EMPTY_LIST : queueGroups;
  const seniorAnswerReviews = isSeniorReviewer ? queueReviews : EMPTY_LIST;
  const seniorAnswerReviewGroups = isSeniorReviewer ? queueGroups : EMPTY_LIST;
  const resolvedAnswerReviews = resolvedReviewsQuery.data || EMPTY_LIST;
  const candidates = isSeniorReviewer ? candidatesQuery.data || EMPTY_LIST : EMPTY_LIST;
  const reviewedCandidates = isSeniorReviewer ? candidateHistoryQuery.data || EMPTY_LIST : EMPTY_LIST;

  useEffect(() => {
    const error = inboxQuery.error
      || answerQueueQuery.error
      || resolvedReviewsQuery.error
      || candidatesQuery.error
      || candidateHistoryQuery.error;
    if (!error) return;
    triggerToast(getUserFacingError(error, 'Không thể tải dữ liệu kiểm duyệt.'));
  }, [
    answerQueueQuery.error,
    candidateHistoryQuery.error,
    candidatesQuery.error,
    inboxQuery.error,
    resolvedReviewsQuery.error,
    triggerToast,
  ]);

  const loadTeacherInbox = useCallback((filters) => {
    if (!includeTeacherInbox) return Promise.resolve();
    if (filters && typeof filters === 'object') {
      const nextFilters = { ...(filters.q ? { q: String(filters.q).trim() } : {}) };
      const unchanged = nextFilters.q === inboxFilters.q;
      if (!unchanged) {
        setInboxFilters(nextFilters);
        return Promise.resolve();
      }
    }
    return inboxQuery.refetch();
  }, [includeTeacherInbox, inboxFilters.q, inboxQuery]);
  const loadAnswerReviews = useCallback(() => answerQueueQuery.refetch(), [answerQueueQuery]);
  const loadResolvedAnswerReviews = useCallback(
    () => resolvedReviewsQuery.refetch(),
    [resolvedReviewsQuery],
  );
  const loadKnowledgeCandidates = useCallback(() => {
    if (!isSeniorReviewer) return Promise.resolve();
    return candidatesQuery.refetch();
  }, [candidatesQuery, isSeniorReviewer]);
  const loadCandidateHistory = useCallback(() => {
    if (!isSeniorReviewer) return Promise.resolve();
    return candidateHistoryQuery.refetch();
  }, [candidateHistoryQuery, isSeniorReviewer]);
  const loadReviewHistory = useCallback(() => Promise.all([
    loadResolvedAnswerReviews(),
    loadCandidateHistory(),
  ]), [loadCandidateHistory, loadResolvedAnswerReviews]);

  const invalidateReviewData = useCallback(() => {
    if (!teacherId) return;
    queryClient.invalidateQueries({ queryKey: ['teacher', 'review'], refetchType: 'active' });
  }, [queryClient, teacherId]);
  useRealtimeEvent(REALTIME_EVENT_TYPES.answerReview, (event) => {
    if (eventMatchesCourse(event, courseId)) invalidateReviewData();
  });
  useRealtimeReconnect(invalidateReviewData);

  const answerEscalationThroughBackend = (escalationId, payload) => (
    teacherReviewApi.answerEscalation(escalationId, payload)
  );

  const handleTeacherAnswerEsc = async (
    escalationId,
    reply,
    createKnowledgeCandidate = false,
    candidateType = 'ACADEMIC_KNOWLEDGE',
    imageIds = [],
  ) => {
    if (isTeacherAnswerSubmitting || !escalationId || !String(reply || '').trim()) return false;
    setIsTeacherAnswerSubmitting(true);
    triggerToast('Đang gửi câu trả lời...');
    const payload = {
      teacherId,
      teacherName: currentUser?.fullName || currentUser?.name || 'Teacher',
      answer: reply,
      createKnowledgeCandidate,
      candidateType,
      imageIds: Array.isArray(imageIds) ? imageIds.filter(Boolean) : [],
    };
    try {
      if (N8N_ENABLED) {
        try {
          await n8nService.submitTeacherAnswer({ questionEscalationId: escalationId, ...payload });
        } catch (n8nError) {
          if (N8N_STRICT) throw n8nError;
          console.warn('n8n teacher answer failed, falling back to backend API:', n8nError);
          await answerEscalationThroughBackend(escalationId, payload);
        }
      } else {
        await answerEscalationThroughBackend(escalationId, payload);
      }
      triggerToast('Đã gửi câu trả lời chính thức.');
      queryClient.setQueryData(inboxQueryKey, (current = EMPTY_LIST) => current.map((item) => (
        item.id === escalationId
          ? {
              ...item,
              status: createKnowledgeCandidate
                ? 'ANSWERED_PENDING_SENIOR_REVIEW'
                : 'ANSWERED_NO_KNOWLEDGE_CANDIDATE',
            }
          : item
      )));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: inboxQueryKey, exact: true }),
        createKnowledgeCandidate
          ? queryClient.invalidateQueries({ queryKey: candidatesQueryKey, exact: true })
          : Promise.resolve(),
      ]);
      return true;
    } catch (error) {
      console.error('Error sending answer:', error);
      triggerToast(getUserFacingError(error, 'Không thể gửi câu trả lời. Vui lòng thử lại.'));
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: inboxQueryKey, exact: true }),
        createKnowledgeCandidate
          ? queryClient.invalidateQueries({ queryKey: candidatesQueryKey, exact: true })
          : Promise.resolve(),
      ]);
      return false;
    } finally {
      setIsTeacherAnswerSubmitting(false);
    }
  };

  const hideEscalationFromTeacherInbox = useCallback(async (escalationId) => {
    if (!escalationId || deletingEscalationIdsRef.current.has(escalationId)) return false;
    deletingEscalationIdsRef.current.add(escalationId);
    setDeletingEscalationIds((current) => [...current, escalationId]);
    try {
      await teacherReviewApi.hideEscalationFromTeacherInbox(escalationId);
      queryClient.setQueryData(inboxQueryKey, (current = EMPTY_LIST) => (
        current.filter((item) => item.id !== escalationId)
      ));
      if (selectedEscalationId === escalationId) setSelectedEscalationId('');
      triggerToast('Đã xoá ticket khỏi hộp thư của bạn. Sinh viên vẫn xem được lịch sử này.');
      return true;
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể xoá ticket khỏi hộp thư.'));
      return false;
    } finally {
      deletingEscalationIdsRef.current.delete(escalationId);
      setDeletingEscalationIds((current) => current.filter((id) => id !== escalationId));
    }
  }, [inboxQueryKey, queryClient, selectedEscalationId, triggerToast]);

  const handleSeniorResolveReview = async (
    reviewId,
    decision,
    notes,
    correctedAnswer = '',
    candidateType = 'ACADEMIC_KNOWLEDGE',
    imageIds = [],
  ) => {
    if (pendingSeniorReviewIds.includes(reviewId)) return false;
    setPendingSeniorReviewIds((current) => [...current, reviewId]);
    triggerToast('Đang xử lý kiểm duyệt cấp cao...');
    const payload = {
      reviewId,
      seniorReviewerId: teacherId,
      seniorReviewerName: reviewerName,
      reviewerRole,
      decision,
      notes,
      createKnowledgeCandidate: decision === 'CREATE_KNOWLEDGE_CANDIDATE',
      candidateType,
      ...(decision === 'CREATE_KNOWLEDGE_CANDIDATE'
        ? { correctedAnswer, imageIds: Array.isArray(imageIds) ? imageIds.filter(Boolean) : [] }
        : {}),
    };
    try {
      if (N8N_ENABLED) {
        try {
          await n8nService.submitSeniorReviewResolution(payload);
        } catch (n8nError) {
          if (N8N_STRICT) throw n8nError;
          console.warn('n8n senior review resolution failed, falling back to backend API:', n8nError);
          await teacherReviewApi.seniorResolveAnswerReview(reviewId, payload);
        }
      } else {
        await teacherReviewApi.seniorResolveAnswerReview(reviewId, payload);
      }
      triggerToast('Đã hoàn tất kiểm duyệt cấp cao.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: answerQueueQueryKey, exact: true }),
        queryClient.invalidateQueries({ queryKey: candidatesQueryKey, exact: true }),
        queryClient.invalidateQueries({ queryKey: resolvedQueryKey, exact: true }),
      ]);
      return true;
    } catch (error) {
      console.error('Error resolving senior review:', error);
      triggerToast(getUserFacingError(error, 'Không thể hoàn tất kiểm duyệt cấp cao.'));
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: answerQueueQueryKey, exact: true }),
        queryClient.invalidateQueries({ queryKey: candidatesQueryKey, exact: true }),
      ]);
      return false;
    } finally {
      setPendingSeniorReviewIds((current) => current.filter((id) => id !== reviewId));
    }
  };

  const submitCandidateDecision = async (id, decision, note) => {
    const payload = {
      decision,
      candidateId: id,
      reviewerId: teacherId,
      reviewerRole,
      reviewerName,
      reviewNote: note,
      ...(decision === 'REJECT' ? { rejectionReason: note } : {}),
    };
    if (N8N_ENABLED) {
      try {
        await n8nService.submitSeniorApproval(payload);
        return;
      } catch (n8nError) {
        if (N8N_STRICT) throw n8nError;
        console.warn('n8n candidate decision failed, falling back to backend API:', n8nError);
      }
    }
    if (decision === 'APPROVE') {
      await teacherReviewApi.approveCandidate(id, {
        reviewerId: teacherId,
        reviewerRole,
        reviewerName,
        reviewNote: note,
      });
    } else {
      await teacherReviewApi.rejectCandidate(id, {
        reviewerId: teacherId,
        reviewerRole,
        reviewerName,
        rejectionReason: note,
        reviewNote: note,
      });
    }
  };

  const handleCandidateDecision = async (id, decision, note) => {
    if (pendingCandidateActionIds.includes(id)) return false;
    setPendingCandidateActionIds((current) => [...current, id]);
    triggerToast(decision === 'APPROVE' ? 'Đang phê duyệt tri thức đề xuất...' : 'Đang từ chối tri thức đề xuất...');
    try {
      await submitCandidateDecision(id, decision, note);
      triggerToast(decision === 'APPROVE'
        ? 'Đã phê duyệt và đưa vào tri thức AI Tutor.'
        : 'Đã từ chối tri thức đề xuất.');
      queryClient.setQueryData(candidatesQueryKey, (current = EMPTY_LIST) => (
        current.filter((candidate) => candidate.id !== id)
      ));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: candidatesQueryKey, exact: true }),
        queryClient.invalidateQueries({ queryKey: candidateHistoryQueryKey, exact: true }),
      ]);
      return true;
    } catch (error) {
      triggerToast(getUserFacingError(
        error,
        decision === 'APPROVE'
          ? 'Không thể phê duyệt tri thức đề xuất.'
          : 'Không thể từ chối tri thức đề xuất.',
      ));
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: candidatesQueryKey, exact: true }),
        queryClient.invalidateQueries({ queryKey: candidateHistoryQueryKey, exact: true }),
      ]);
      return false;
    } finally {
      setPendingCandidateActionIds((current) => current.filter((candidateId) => candidateId !== id));
    }
  };

  return {
    escalations,
    isTeacherInboxLoading: includeTeacherInbox && (inboxQuery.isPending || inboxQuery.isFetching),
    selectedEscalation,
    setSelectedEscalation,
    candidates,
    isCandidatesLoading: isSeniorReviewer && (candidatesQuery.isPending || candidatesQuery.isFetching),
    reviewedCandidates,
    isCandidateHistoryLoading: isSeniorReviewer
      && (candidateHistoryQuery.isPending || candidateHistoryQuery.isFetching),
    answerReviews,
    answerReviewGroups,
    seniorAnswerReviews,
    seniorAnswerReviewGroups,
    resolvedAnswerReviews,
    isAnswerReviewsLoading: Boolean(teacherId)
      && (answerQueueQuery.isPending || answerQueueQuery.isFetching),
    isResolvedReviewsLoading: Boolean(teacherId)
      && (resolvedReviewsQuery.isPending || resolvedReviewsQuery.isFetching),
    isTeacherAnswerSubmitting,
    deletingEscalationIds,
    pendingCandidateActionIds,
    pendingSeniorReviewIds,
    loadTeacherInbox,
    loadAnswerReviews,
    loadResolvedAnswerReviews,
    loadKnowledgeCandidates,
    loadCandidateHistory,
    loadReviewHistory,
    handleTeacherAnswerEsc,
    hideEscalationFromTeacherInbox,
    handleSeniorResolveReview,
    handleApproveCandidate: (id, note = 'Đã phê duyệt') => handleCandidateDecision(id, 'APPROVE', note),
    handleRejectCandidate: (id, reason = 'Giảng viên đã từ chối') => handleCandidateDecision(id, 'REJECT', reason),
  };
}

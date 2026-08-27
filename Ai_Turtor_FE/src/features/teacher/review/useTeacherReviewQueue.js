import { useCallback, useRef, useState } from 'react';
import { getUserFacingError } from '../../../services/apiClient';
import { n8nService } from '../../../services/n8nService';
import { N8N_ENABLED, N8N_STRICT } from '../../../services/n8nClient';
import { teacherReviewApi } from '../../../services/teacherReviewApi';
import { asArray, normalizeAnswerReview, normalizeGroupedAnswerReview, normalizeTeacherInboxItem } from '../../../services/normalizers';
import { normalizeAccountRole } from '../../../constants/roles';
import { canReviewKnowledge } from '../../../utils/permissions';

export function useTeacherReviewQueue({
  currentUser,
  teacherId,
  courseId,
  triggerToast,
  includeTeacherInbox = true,
}) {
  const [escalations, setEscalations] = useState([]);
  const [isTeacherInboxLoading, setIsTeacherInboxLoading] = useState(false);
  const [selectedEscalation, setSelectedEscalation] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [isCandidatesLoading, setIsCandidatesLoading] = useState(false);
  const [reviewedCandidates, setReviewedCandidates] = useState([]);
  const [isCandidateHistoryLoading, setIsCandidateHistoryLoading] = useState(false);
  const [answerReviews, setAnswerReviews] = useState([]);
  const [answerReviewGroups, setAnswerReviewGroups] = useState([]);
  const [seniorAnswerReviews, setSeniorAnswerReviews] = useState([]);
  const [seniorAnswerReviewGroups, setSeniorAnswerReviewGroups] = useState([]);
  const [isAnswerReviewsLoading, setIsAnswerReviewsLoading] = useState(false);
  const [resolvedAnswerReviews, setResolvedAnswerReviews] = useState([]);
  const [isResolvedReviewsLoading, setIsResolvedReviewsLoading] = useState(false);
  const [isTeacherAnswerSubmitting, setIsTeacherAnswerSubmitting] = useState(false);
  const [deletingEscalationIds, setDeletingEscalationIds] = useState([]);
  const deletingEscalationIdsRef = useRef(new Set());
  const [pendingCandidateActionIds, setPendingCandidateActionIds] = useState([]);
  const [pendingSeniorReviewIds, setPendingSeniorReviewIds] = useState([]);
  const reviewerName = currentUser?.fullName || currentUser?.name || 'Senior Mentor';
  const reviewerRole = normalizeAccountRole(currentUser?.originalRole || currentUser?.role);
  const isSeniorReviewer = canReviewKnowledge(reviewerRole);

  const loadTeacherInbox = async (filters = {}) => {
    if (!includeTeacherInbox) {
      setEscalations([]);
      setSelectedEscalation(null);
      return;
    }
    setIsTeacherInboxLoading(true);
    try {
      const params = { ...(courseId ? { courseId } : {}), ...filters };
      const data = await teacherReviewApi.getTeacherEscalations(teacherId, params);
      const items = asArray(data, 'escalations', 'inbox', 'content').map(normalizeTeacherInboxItem);
      setEscalations(items);
      setSelectedEscalation((current) => (
        items.find((item) => item.id === current?.id) || items[0] || null
      ));
    } catch {
      setEscalations([]);
    } finally {
      setIsTeacherInboxLoading(false);
    }
  };

  const loadResolvedAnswerReviews = async () => {
    setIsResolvedReviewsLoading(true);
    try {
      const reviews = await teacherReviewApi.getAnswerReviews({ status: 'RESOLVED', courseId });
      setResolvedAnswerReviews(reviews.map(normalizeAnswerReview));
    } catch (error) {
      setResolvedAnswerReviews([]);
      triggerToast(getUserFacingError(error, 'Không thể tải lịch sử phản hồi đã xử lý.'));
    } finally {
      setIsResolvedReviewsLoading(false);
    }
  };

  const loadAnswerReviews = async () => {
    setIsAnswerReviewsLoading(true);
    try {
      if (isSeniorReviewer) {
        const queue = await teacherReviewApi.getSeniorPendingAnswerReviewQueue(courseId);
        setAnswerReviews([]);
        setAnswerReviewGroups([]);
        setSeniorAnswerReviews((queue.reviews || []).map(normalizeAnswerReview));
        setSeniorAnswerReviewGroups((queue.groups || []).map(normalizeGroupedAnswerReview));
      } else {
        const queue = await teacherReviewApi.getMentorPendingAnswerReviewQueue(courseId);
        setAnswerReviews((queue.reviews || []).map(normalizeAnswerReview));
        setAnswerReviewGroups((queue.groups || []).map(normalizeGroupedAnswerReview));
        setSeniorAnswerReviews([]);
        setSeniorAnswerReviewGroups([]);
      }
    } catch (error) {
      setAnswerReviews([]);
      setAnswerReviewGroups([]);
      setSeniorAnswerReviews([]);
      setSeniorAnswerReviewGroups([]);
      triggerToast(getUserFacingError(error, 'Không thể tải phản hồi cần kiểm tra.'));
    } finally {
      setIsAnswerReviewsLoading(false);
    }
  };

  const loadKnowledgeCandidates = async () => {
    if (!isSeniorReviewer) {
      setCandidates([]);
      return;
    }
    setIsCandidatesLoading(true);
    try {
      const data = await teacherReviewApi.getKnowledgeCandidates('PENDING_SENIOR_REVIEW', courseId);
      setCandidates(asArray(data, 'candidates', 'content'));
    } catch (error) {
      setCandidates([]);
      triggerToast(getUserFacingError(error, 'Không thể tải tri thức được đề xuất.'));
    } finally {
      setIsCandidatesLoading(false);
    }
  };

  const loadCandidateHistory = async () => {
    if (!isSeniorReviewer) {
      setReviewedCandidates([]);
      return;
    }
    setIsCandidateHistoryLoading(true);
    try {
      const items = await teacherReviewApi.getKnowledgeCandidates('', courseId);
      setReviewedCandidates(items
        .filter((candidate) => {
          const status = String(candidate?.status || '').trim().toUpperCase();
          return status && !['PENDING_SENIOR_REVIEW', 'PENDING_REVIEW'].includes(status);
        })
        .sort((left, right) => {
          const leftTime = new Date(left.reviewedAt || left.updatedAt || left.indexedAt || 0).getTime();
          const rightTime = new Date(right.reviewedAt || right.updatedAt || right.indexedAt || 0).getTime();
          return rightTime - leftTime;
        }));
    } catch (error) {
      setReviewedCandidates([]);
      triggerToast(getUserFacingError(error, 'Không thể tải lịch sử phê duyệt tri thức.'));
    } finally {
      setIsCandidateHistoryLoading(false);
    }
  };

  const loadReviewHistory = () => Promise.all([
    loadResolvedAnswerReviews(),
    loadCandidateHistory(),
  ]);

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
      setEscalations((current) => current.map((item) => (
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
        loadTeacherInbox(),
        createKnowledgeCandidate ? loadKnowledgeCandidates() : Promise.resolve(),
      ]);
      return true;
    } catch (error) {
      console.error('Error sending answer:', error);
      triggerToast(getUserFacingError(error, 'Không thể gửi câu trả lời. Vui lòng thử lại.'));
      await Promise.allSettled([
        loadTeacherInbox(),
        createKnowledgeCandidate ? loadKnowledgeCandidates() : Promise.resolve(),
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
      setEscalations((current) => current.filter((item) => item.id !== escalationId));
      setSelectedEscalation((current) => (current?.id === escalationId ? null : current));
      triggerToast('Đã xoá ticket khỏi hộp thư của bạn. Sinh viên vẫn xem được lịch sử này.');
      return true;
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể xoá ticket khỏi hộp thư.'));
      return false;
    } finally {
      deletingEscalationIdsRef.current.delete(escalationId);
      setDeletingEscalationIds((current) => current.filter((id) => id !== escalationId));
    }
  }, [triggerToast]);

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
      await Promise.all([loadAnswerReviews(), loadKnowledgeCandidates()]);
      loadResolvedAnswerReviews();
      return true;
    } catch (error) {
      console.error('Error resolving senior review:', error);
      triggerToast(getUserFacingError(error, 'Không thể hoàn tất kiểm duyệt cấp cao.'));
      await Promise.allSettled([loadAnswerReviews(), loadKnowledgeCandidates()]);
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
      setCandidates((current) => current.filter((candidate) => candidate.id !== id));
      await Promise.all([loadKnowledgeCandidates(), loadCandidateHistory()]);
      return true;
    } catch (error) {
      triggerToast(getUserFacingError(
        error,
        decision === 'APPROVE'
          ? 'Không thể phê duyệt tri thức đề xuất.'
          : 'Không thể từ chối tri thức đề xuất.',
      ));
      await Promise.allSettled([loadKnowledgeCandidates(), loadCandidateHistory()]);
      return false;
    } finally {
      setPendingCandidateActionIds((current) => current.filter((candidateId) => candidateId !== id));
    }
  };

  return {
    escalations,
    isTeacherInboxLoading,
    selectedEscalation,
    setSelectedEscalation,
    candidates,
    setCandidates,
    isCandidatesLoading,
    reviewedCandidates,
    isCandidateHistoryLoading,
    answerReviews,
    answerReviewGroups,
    seniorAnswerReviews,
    seniorAnswerReviewGroups,
    resolvedAnswerReviews,
    isAnswerReviewsLoading,
    isResolvedReviewsLoading,
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

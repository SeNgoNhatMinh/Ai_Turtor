import { useState } from 'react';
import { getUserFacingError } from '../../../services/apiClient';
import { n8nService } from '../../../services/n8nService';
import { N8N_ENABLED, N8N_STRICT } from '../../../services/n8nClient';
import { teacherReviewApi } from '../../../services/teacherReviewApi';
import { asArray, normalizeAnswerReview, normalizeTeacherInboxItem } from '../../../services/normalizers';
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
  const [answerReviews, setAnswerReviews] = useState([]);
  const [seniorAnswerReviews, setSeniorAnswerReviews] = useState([]);
  const [isAnswerReviewsLoading, setIsAnswerReviewsLoading] = useState(false);
  const [resolvedAnswerReviews, setResolvedAnswerReviews] = useState([]);
  const [isResolvedReviewsLoading, setIsResolvedReviewsLoading] = useState(false);
  const [isTeacherAnswerSubmitting, setIsTeacherAnswerSubmitting] = useState(false);
  const [pendingCandidateActionIds, setPendingCandidateActionIds] = useState([]);
  const [pendingSeniorReviewIds, setPendingSeniorReviewIds] = useState([]);
  const reviewerName = currentUser?.fullName || currentUser?.name || 'Senior Mentor';
  const reviewerRole = normalizeAccountRole(currentUser?.originalRole || currentUser?.role);
  const isSeniorReviewer = canReviewKnowledge(reviewerRole);

  const loadTeacherInbox = async () => {
    if (!includeTeacherInbox) {
      setEscalations([]);
      setSelectedEscalation(null);
      return;
    }
    setIsTeacherInboxLoading(true);
    try {
      const data = await teacherReviewApi.getTeacherEscalations(teacherId, { courseId });
      const items = asArray(data, 'escalations', 'inbox', 'content').map(normalizeTeacherInboxItem);
      setEscalations(items);
      setSelectedEscalation((current) => current || items[0] || null);
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
        const seniorPending = await teacherReviewApi.getSeniorPendingAnswerReviews(courseId);
        setAnswerReviews([]);
        setSeniorAnswerReviews((Array.isArray(seniorPending) ? seniorPending : []).map(normalizeAnswerReview));
      } else {
        const mentorPending = await teacherReviewApi.getMentorPendingAnswerReviews(courseId);
        setAnswerReviews((Array.isArray(mentorPending) ? mentorPending : []).map(normalizeAnswerReview));
        setSeniorAnswerReviews([]);
      }
    } catch (error) {
      setAnswerReviews([]);
      setSeniorAnswerReviews([]);
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
    try {
      const data = await teacherReviewApi.getKnowledgeCandidates('PENDING_SENIOR_REVIEW', courseId);
      setCandidates(asArray(data, 'candidates', 'content'));
    } catch (error) {
      setCandidates([]);
      triggerToast(getUserFacingError(error, 'Không thể tải tri thức được đề xuất.'));
    }
  };

  const answerEscalationThroughBackend = (escalationId, payload) => (
    teacherReviewApi.answerEscalation(escalationId, payload)
  );

  const handleTeacherAnswerEsc = async (
    escalationId,
    reply,
    createKnowledgeCandidate = false,
    candidateType = 'ACADEMIC_KNOWLEDGE',
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

  const handleSeniorResolveReview = async (
    reviewId,
    decision,
    notes,
    correctedAnswer = '',
    candidateType = 'ACADEMIC_KNOWLEDGE',
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
      ...(decision === 'CREATE_KNOWLEDGE_CANDIDATE' ? { correctedAnswer } : {}),
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
      await loadKnowledgeCandidates();
      return true;
    } catch (error) {
      triggerToast(getUserFacingError(
        error,
        decision === 'APPROVE'
          ? 'Không thể phê duyệt tri thức đề xuất.'
          : 'Không thể từ chối tri thức đề xuất.',
      ));
      await Promise.allSettled([loadKnowledgeCandidates()]);
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
    answerReviews,
    seniorAnswerReviews,
    resolvedAnswerReviews,
    isAnswerReviewsLoading,
    isResolvedReviewsLoading,
    isTeacherAnswerSubmitting,
    pendingCandidateActionIds,
    pendingSeniorReviewIds,
    loadTeacherInbox,
    loadAnswerReviews,
    loadResolvedAnswerReviews,
    loadKnowledgeCandidates,
    handleTeacherAnswerEsc,
    handleSeniorResolveReview,
    handleApproveCandidate: (id, note = 'Đã phê duyệt') => handleCandidateDecision(id, 'APPROVE', note),
    handleRejectCandidate: (id, reason = 'Giảng viên đã từ chối') => handleCandidateDecision(id, 'REJECT', reason),
  };
}

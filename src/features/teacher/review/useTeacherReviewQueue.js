import { useState } from 'react';
import { getUserFacingError } from '../../../services/apiClient';
import { n8nService } from '../../../services/n8nService';
import { N8N_ENABLED, N8N_STRICT } from '../../../services/n8nClient';
import { teacherReviewApi } from '../../../services/teacherReviewApi';
import { asArray, normalizeAnswerReview, normalizeTeacherInboxItem } from '../../../services/normalizers';
import { normalizeAccountRole } from '../../../constants/roles';
import { canReviewKnowledge } from '../../../utils/permissions';

export function useTeacherReviewQueue({ currentUser, teacherId, courseId, triggerToast }) {
  const [escalations, setEscalations] = useState([]);
  const [isTeacherInboxLoading, setIsTeacherInboxLoading] = useState(false);
  const [selectedEscalation, setSelectedEscalation] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [answerReviews, setAnswerReviews] = useState([]);
  const [seniorAnswerReviews, setSeniorAnswerReviews] = useState([]);
  const [isAnswerReviewsLoading, setIsAnswerReviewsLoading] = useState(false);
  const [pendingCandidateActionIds, setPendingCandidateActionIds] = useState([]);
  const [pendingSeniorReviewIds, setPendingSeniorReviewIds] = useState([]);
  const reviewerName = currentUser?.fullName || currentUser?.name || 'Senior Mentor';
  const reviewerRole = normalizeAccountRole(currentUser?.originalRole || currentUser?.role);
  const isSeniorReviewer = canReviewKnowledge(reviewerRole);

  const loadTeacherInbox = async () => {
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
      triggerToast(getUserFacingError(error, 'Unable to load AI answer reviews.'));
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
      triggerToast(getUserFacingError(error, 'Unable to load suggested AI answers.'));
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
    triggerToast('Sending answer...');
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
      triggerToast('Answer sent successfully.');
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
    } catch (error) {
      console.error('Error sending answer:', error);
      triggerToast(getUserFacingError(error, 'Unable to send answer. Please try again.'));
      await Promise.allSettled([
        loadTeacherInbox(),
        createKnowledgeCandidate ? loadKnowledgeCandidates() : Promise.resolve(),
      ]);
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
    triggerToast('Resolving senior review...');
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
      triggerToast('Senior review resolved.');
      await Promise.all([loadAnswerReviews(), loadKnowledgeCandidates()]);
      return true;
    } catch (error) {
      console.error('Error resolving senior review:', error);
      triggerToast(getUserFacingError(error, 'Unable to resolve senior review.'));
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
    triggerToast(decision === 'APPROVE' ? 'Approving suggested AI answer...' : 'Rejecting suggested AI answer...');
    try {
      await submitCandidateDecision(id, decision, note);
      triggerToast(decision === 'APPROVE'
        ? 'Approved and indexed into AI Tutor knowledge.'
        : 'Suggested AI answer rejected.');
      setCandidates((current) => current.filter((candidate) => candidate.id !== id));
      await loadKnowledgeCandidates();
      return true;
    } catch (error) {
      triggerToast(getUserFacingError(
        error,
        decision === 'APPROVE'
          ? 'Unable to approve suggested AI answer.'
          : 'Unable to reject suggested AI answer.',
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
    isAnswerReviewsLoading,
    pendingCandidateActionIds,
    pendingSeniorReviewIds,
    loadTeacherInbox,
    loadAnswerReviews,
    loadKnowledgeCandidates,
    handleTeacherAnswerEsc,
    handleSeniorResolveReview,
    handleApproveCandidate: (id, note = 'Approved') => handleCandidateDecision(id, 'APPROVE', note),
    handleRejectCandidate: (id, reason = 'Rejected by mentor') => handleCandidateDecision(id, 'REJECT', reason),
  };
}

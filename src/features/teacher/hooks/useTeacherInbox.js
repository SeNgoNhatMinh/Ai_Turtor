import { useState, useCallback } from 'react';
import { apiService } from '../../../services/api';
import { useAuthStore } from '../../../app/store/authStore';
import { useUiStore } from '../../../app/store/uiStore';
import { normalizeTeacherInboxItem } from '../../../services/normalizers';
import { getUserFacingError } from '../../../services/apiClient';

export function useTeacherInbox() {
  const getTeacherUserId = useAuthStore(state => state.getTeacherUserId);
  const courseId = useUiStore(state => state.courseId);
  const classId = useUiStore(state => state.classId);
  const triggerToast = useUiStore(state => state.setToastMessage);

  const [teacherChatInbox, setTeacherChatInbox] = useState([]);
  const [isTeacherInboxLoading, setIsTeacherInboxLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [answerReviews, setAnswerReviews] = useState([]);

  const loadTeacherInbox = useCallback(async () => {
    setIsTeacherInboxLoading(true);
    try {
      const data = await apiService.getTeacherInbox(getTeacherUserId(), courseId, classId);
      const items = Array.isArray(data) ? data : data?.content || [];
      setTeacherChatInbox(items.map(normalizeTeacherInboxItem));
    } catch (e) {
      console.warn('Failed to load teacher inbox:', e);
      setTeacherChatInbox([]);
    } finally {
      setIsTeacherInboxLoading(false);
    }
  }, [getTeacherUserId, courseId, classId]);

  const handleTeacherAnswerEsc = useCallback(async (escalationId, reply, createKnowledgeCandidate = true, candidateType = 'ACADEMIC_KNOWLEDGE') => {
    try {
      await apiService.answerEscalation(getTeacherUserId(), escalationId, reply, createKnowledgeCandidate, candidateType);
      triggerToast('Escalation answered.');
      loadTeacherInbox();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Failed to submit answer.'));
    }
  }, [getTeacherUserId, loadTeacherInbox, triggerToast]);

  const loadKnowledgeCandidates = useCallback(async () => {
    try {
      const data = await apiService.getKnowledgeCandidates(courseId);
      setCandidates(Array.isArray(data) ? data : data?.content || []);
    } catch (e) {
      console.warn('Failed to load candidates:', e);
    }
  }, [courseId]);

  const handleApproveCandidate = useCallback(async (id, reviewNote = 'Approved') => {
    try {
      await apiService.approveCandidate(id, getTeacherUserId(), reviewNote);
      triggerToast('Candidate approved.');
      loadKnowledgeCandidates();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Failed to approve candidate.'));
    }
  }, [getTeacherUserId, loadKnowledgeCandidates, triggerToast]);

  const handleRejectCandidate = useCallback(async (id, rejectionReason = 'Rejected by mentor') => {
    try {
      await apiService.rejectCandidate(id, getTeacherUserId(), rejectionReason);
      triggerToast('Candidate rejected.');
      loadKnowledgeCandidates();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Failed to reject candidate.'));
    }
  }, [getTeacherUserId, loadKnowledgeCandidates, triggerToast]);

  const loadAnswerReviews = useCallback(async () => {
    // Implement loading logic
    try {
      const data = await apiService.getAnswerReviews(courseId);
      setAnswerReviews(Array.isArray(data) ? data : data?.content || []);
    } catch(e) {
      console.warn(e);
    }
  }, [courseId]);

  return {
    teacherChatInbox,
    isTeacherInboxLoading,
    candidates,
    answerReviews,
    loadTeacherInbox,
    handleTeacherAnswerEsc,
    loadKnowledgeCandidates,
    handleApproveCandidate,
    handleRejectCandidate,
    loadAnswerReviews
  };
}

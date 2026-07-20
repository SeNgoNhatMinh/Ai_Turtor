import { useEffect, useState } from 'react';
import TeacherSupportQueueTab from '../../../pages/teacher/TeacherSupportQueueTab';
import { ACADEMIC_CANDIDATE_TYPES } from '../../../constants/knowledgeFlow';
import { useTeacherReviewQueue } from './useTeacherReviewQueue';
import './TeacherReviewPage.css';

export default function TeacherReviewPage({
  currentUser,
  teacherId,
  courseId,
  classId,
  triggerToast,
}) {
  const review = useTeacherReviewQueue({ currentUser, teacherId, courseId, triggerToast });
  const [reply, setReply] = useState('');
  const [createKnowledgeCandidate, setCreateKnowledgeCandidate] = useState(false);
  const [candidateType, setCandidateType] = useState('ACADEMIC_KNOWLEDGE');
  const [candidateNotes, setCandidateNotes] = useState({});

  useEffect(() => {
    review.loadTeacherInbox();
    review.loadAnswerReviews();
    review.loadKnowledgeCandidates();
    // Review resources are fetched only while this route is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, courseId, classId]);

  const handleNoteChange = (candidateId, value) => {
    setCandidateNotes((current) => ({ ...current, [candidateId]: value }));
  };

  const handleAnswerEscalation = async (event) => {
    event.preventDefault();
    if (!reply.trim() || !review.selectedEscalation?.id || review.isTeacherAnswerSubmitting) return;
    const safeCandidateType = createKnowledgeCandidate && ACADEMIC_CANDIDATE_TYPES.has(candidateType)
      ? candidateType
      : 'ACADEMIC_KNOWLEDGE';
    const succeeded = await review.handleTeacherAnswerEsc(
      review.selectedEscalation.id,
      reply,
      createKnowledgeCandidate,
      safeCandidateType,
    );
    if (succeeded) {
      setReply('');
      setCreateKnowledgeCandidate(false);
    }
  };

  return (
    <TeacherSupportQueueTab
      isTeacherInboxLoading={review.isTeacherInboxLoading}
      escalations={review.escalations}
      selectedEscalation={review.selectedEscalation}
      setSelectedEscalation={review.setSelectedEscalation}
      loadTeacherInbox={review.loadTeacherInbox}
      teacherEscReply={reply}
      setTeacherEscReply={setReply}
      onAnswerEsc={handleAnswerEscalation}
      isTeacherAnswerSubmitting={review.isTeacherAnswerSubmitting}
      createKnowledgeCandidate={createKnowledgeCandidate}
      setCreateKnowledgeCandidate={setCreateKnowledgeCandidate}
      candidateType={candidateType}
      setCandidateType={setCandidateType}
      answerReviews={review.answerReviews}
      isAnswerReviewsLoading={review.isAnswerReviewsLoading}
      loadAnswerReviews={review.loadAnswerReviews}
      seniorAnswerReviews={review.seniorAnswerReviews}
      pendingCandidateActionIds={review.pendingCandidateActionIds}
      pendingSeniorReviewIds={review.pendingSeniorReviewIds}
      handleSeniorResolveReview={review.handleSeniorResolveReview}
      candidates={review.candidates}
      candidateNotes={candidateNotes}
      handleNoteChange={handleNoteChange}
      handleApproveCandidate={review.handleApproveCandidate}
      handleRejectCandidate={review.handleRejectCandidate}
      currentUserRole={currentUser?.originalRole || currentUser?.role}
      currentUser={currentUser}
    />
  );
}

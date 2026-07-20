import { useEffect, useState } from 'react';
import PageHeader from '../../../components/common/PageHeader';
import { uiCopy } from '../../../constants/uiCopy';
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
  reviewScope = 'teacher',
}) {
  const isAdminReview = reviewScope === 'admin';
  const review = useTeacherReviewQueue({
    currentUser,
    teacherId,
    courseId,
    triggerToast,
    includeTeacherInbox: !isAdminReview,
  });
  const [reply, setReply] = useState('');
  const [createKnowledgeCandidate, setCreateKnowledgeCandidate] = useState(false);
  const [candidateType, setCandidateType] = useState('ACADEMIC_KNOWLEDGE');
  const [candidateNotes, setCandidateNotes] = useState({});

  useEffect(() => {
    if (!isAdminReview) review.loadTeacherInbox();
    review.loadAnswerReviews();
    review.loadKnowledgeCandidates();
    review.loadResolvedAnswerReviews?.();
    // Review resources are fetched only while this route is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, courseId, classId, isAdminReview]);

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
    <div className="portal-section teacher-feature-page teacher-review-feature-page">
      <PageHeader
        title={isAdminReview ? 'Kiểm duyệt phản hồi & tri thức AI' : uiCopy.teacher.review.title}
        description={isAdminReview
          ? 'Theo dõi phản hồi nghiêm trọng, xử lý Knowledge Candidate và kiểm tra lịch sử quyết định.'
          : uiCopy.teacher.review.subtitle}
      />
      <TeacherSupportQueueTab
        showEscalations={!isAdminReview}
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
        resolvedAnswerReviews={review.resolvedAnswerReviews}
        isResolvedReviewsLoading={review.isResolvedReviewsLoading}
        loadResolvedAnswerReviews={review.loadResolvedAnswerReviews}
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
    </div>
  );
}

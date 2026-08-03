import { useEffect, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import AnswerReviewWorkspace from '../teacher/review/AnswerReviewWorkspace';
import { useTeacherReviewQueue } from '../teacher/review/useTeacherReviewQueue';
import { useRealtimeEvent, useRealtimeReconnect } from '../realtime/realtimeContext';
import { eventMatchesCourse, REALTIME_EVENT_TYPES } from '../realtime/realtimeEvents';
import './QualityReviewPage.css';

export default function QualityReviewPage({
  currentUser,
  reviewerId,
  courseId,
  triggerToast,
  mode = 'senior',
}) {
  const review = useTeacherReviewQueue({
    currentUser,
    teacherId: reviewerId,
    courseId,
    triggerToast,
    includeTeacherInbox: false,
  });
  const [candidateNotes, setCandidateNotes] = useState({});
  const isAdmin = mode === 'admin';

  useEffect(() => {
    review.loadAnswerReviews();
    review.loadKnowledgeCandidates();
    review.loadReviewHistory();
    // Resources are loaded only while this role-specific route is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewerId, courseId]);

  useRealtimeEvent(REALTIME_EVENT_TYPES.answerReview, (event) => {
    if (!eventMatchesCourse(event, courseId)) return;
    review.loadAnswerReviews();
    review.loadKnowledgeCandidates();
    review.loadReviewHistory();
  });
  useRealtimeReconnect(() => {
    review.loadAnswerReviews();
    review.loadKnowledgeCandidates();
    review.loadReviewHistory();
  });

  const handleNoteChange = (candidateId, value) => {
    setCandidateNotes((current) => ({ ...current, [candidateId]: value }));
  };

  return (
    <div className="portal-section teacher-feature-page teacher-review-feature-page quality-review-page">
      <PageHeader
        eyebrow={isAdmin ? 'Giám sát AI' : 'Kiểm duyệt chuyên môn'}
        title={isAdmin ? 'Giám sát chất lượng AI' : 'Trung tâm kiểm duyệt chuyên môn'}
        description={isAdmin
          ? 'Theo dõi phản hồi nghiêm trọng và tri thức đề xuất. Admin không tham gia ChatRoom của lớp.'
          : 'Xử lý phản hồi nghiêm trọng, tạo tri thức đúng và chỉ phê duyệt vào RAG sau khi đã đối chiếu.'}
      />
      <AnswerReviewWorkspace
        mode={mode}
        loading={review.isAnswerReviewsLoading}
        resolvedLoading={review.isResolvedReviewsLoading}
        groups={review.seniorAnswerReviewGroups || []}
        reviews={review.seniorAnswerReviews || []}
        resolvedReviews={review.resolvedAnswerReviews || []}
        onRefresh={review.loadAnswerReviews}
        onRefreshResolved={review.loadResolvedAnswerReviews}
        pendingReviewIds={review.pendingSeniorReviewIds || []}
        onResolveReview={review.handleSeniorResolveReview}
        candidates={review.candidates || []}
        candidatesLoading={review.isCandidatesLoading}
        reviewedCandidates={review.reviewedCandidates || []}
        candidateHistoryLoading={review.isCandidateHistoryLoading}
        candidateNotes={candidateNotes}
        onCandidateNoteChange={handleNoteChange}
        onApproveCandidate={review.handleApproveCandidate}
        onRejectCandidate={review.handleRejectCandidate}
        pendingCandidateIds={review.pendingCandidateActionIds || []}
        currentReviewerId={reviewerId}
        onRefreshCandidates={review.loadKnowledgeCandidates}
        onRefreshHistory={review.loadReviewHistory}
      />
    </div>
  );
}

import { useState } from 'react';
import { DatabaseZap, History, ShieldAlert } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import AnswerReviewWorkspace from '../teacher/review/AnswerReviewWorkspace';
import { useTeacherReviewQueue } from '../teacher/review/useTeacherReviewQueue';
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
  const pendingReviewCount = review.seniorAnswerReviewGroups?.length || review.seniorAnswerReviews?.length || 0;
  const pendingCandidateCount = review.candidates?.length || 0;
  const historyCount = (review.resolvedAnswerReviews?.length || 0) + (review.reviewedCandidates?.length || 0);

  const handleNoteChange = (candidateId, value) => {
    setCandidateNotes((current) => ({ ...current, [candidateId]: value }));
  };

  return (
    <div className="portal-section teacher-feature-page teacher-review-feature-page quality-review-page">
      <PageHeader
        className="senior-review-hero"
        eyebrow="Kiểm duyệt chuyên môn"
        title="Trung tâm kiểm duyệt chuyên môn"
        description="Xử lý phản hồi nghiêm trọng, tạo tri thức đúng và chỉ phê duyệt vào RAG sau khi đã đối chiếu."
        actions={(
          <div className="senior-review-hero__stats" aria-label="Tổng quan hàng đợi kiểm duyệt">
            <div><span><ShieldAlert size={18} /></span><strong>{pendingReviewCount}</strong><small>Phản hồi nghiêm trọng</small></div>
            <div><span><DatabaseZap size={18} /></span><strong>{pendingCandidateCount}</strong><small>Tri thức chờ duyệt</small></div>
            <div><span><History size={18} /></span><strong>{historyCount}</strong><small>Quyết định đã lưu</small></div>
          </div>
        )}
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

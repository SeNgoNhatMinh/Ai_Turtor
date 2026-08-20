import { useEffect, useState } from 'react';
import PageHeader from '../../../components/common/PageHeader';
import AppTabs from '../../../components/common/AppTabs';
import { uiCopy } from '../../../constants/uiCopy';
import { ACADEMIC_CANDIDATE_TYPES } from '../../../constants/knowledgeFlow';
import { useTeacherReviewQueue } from './useTeacherReviewQueue';
import { useRealtimeEvent, useRealtimeReconnect } from '../../realtime/realtimeContext';
import { eventMatchesCourse, REALTIME_EVENT_TYPES } from '../../realtime/realtimeEvents';
import AnswerReviewWorkspace from './AnswerReviewWorkspace';
import TeacherSupportInbox from './TeacherSupportInbox';
import './TeacherReviewPage.css';

export default function TeacherReviewPage({
  currentUser,
  teacherId,
  courseId,
  classId,
  triggerToast,
}) {
  const review = useTeacherReviewQueue({
    currentUser,
    teacherId,
    courseId,
    triggerToast,
    includeTeacherInbox: true,
  });
  const [reply, setReply] = useState('');
  const [replyImages, setReplyImages] = useState([]);
  const [createKnowledgeCandidate, setCreateKnowledgeCandidate] = useState(false);
  const [candidateType, setCandidateType] = useState('ACADEMIC_KNOWLEDGE');
  const answerReviewCount = review.answerReviewGroups?.length || review.answerReviews?.length || 0;

  useEffect(() => {
    review.loadTeacherInbox({ courseId });
    review.loadAnswerReviews();
    review.loadResolvedAnswerReviews?.();
    // Review resources are fetched only while this route is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, courseId, classId]);

  useRealtimeEvent(REALTIME_EVENT_TYPES.answerReview, (event) => {
    if (!eventMatchesCourse(event, courseId)) return;
    review.loadAnswerReviews();
  });
  useRealtimeReconnect(() => {
    review.loadAnswerReviews();
    review.loadResolvedAnswerReviews?.();
  });

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
      replyImages.map((item) => item.fileId).filter(Boolean),
    );
    if (succeeded) {
      setReply('');
      setReplyImages([]);
      setCreateKnowledgeCandidate(false);
    }
  };

  return (
    <div className="portal-section teacher-feature-page teacher-review-feature-page">
      <PageHeader
        eyebrow="Hỗ trợ & chất lượng AI"
        title={uiCopy.teacher.review.title}
        description="Hỗ trợ sinh viên theo lớp phụ trách và xác minh phản hồi AI ở mức Teacher. Lịch sử ChatRoom vẫn xem lại được sau khi đóng."
        actions={(
          <div className="teacher-review-header-stats" aria-label="Tổng quan hàng đợi">
            <div>
              <strong>{review.escalations.length}</strong>
              <span>Yêu cầu hỗ trợ</span>
            </div>
            <div>
              <strong>{answerReviewCount}</strong>
              <span>Phản hồi AI</span>
            </div>
          </div>
        )}
      />
      <AppTabs
        className="teacher-review-tabs"
        destroyOnHidden={false}
        items={[
          {
            key: 'support',
            label: `Hỗ trợ sinh viên (${review.escalations.length})`,
            children: (
              <TeacherSupportInbox
                currentUser={currentUser}
                loading={review.isTeacherInboxLoading}
                escalations={review.escalations}
                selectedEscalation={review.selectedEscalation}
                onSelectEscalation={review.setSelectedEscalation}
                  onRefresh={() => review.loadTeacherInbox({})}
                  onSearch={(q) => review.loadTeacherInbox({ q })}
                reply={reply}
                onReplyChange={setReply}
                replyImages={replyImages}
                onReplyImagesChange={setReplyImages}
                onSubmitAnswer={handleAnswerEscalation}
                isSubmitting={review.isTeacherAnswerSubmitting}
                createKnowledgeCandidate={createKnowledgeCandidate}
                onCreateKnowledgeCandidateChange={setCreateKnowledgeCandidate}
                candidateType={candidateType}
                onCandidateTypeChange={setCandidateType}
              />
            ),
          },
          {
            key: 'answer-reviews',
            label: `Phản hồi AI (${answerReviewCount})`,
            children: (
              <AnswerReviewWorkspace
                mode="mentor"
                loading={review.isAnswerReviewsLoading}
                resolvedLoading={review.isResolvedReviewsLoading}
                groups={review.answerReviewGroups || []}
                reviews={review.answerReviews || []}
                resolvedReviews={review.resolvedAnswerReviews || []}
                onRefresh={review.loadAnswerReviews}
                onRefreshResolved={review.loadResolvedAnswerReviews}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

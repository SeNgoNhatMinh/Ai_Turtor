import { useEffect, useState } from 'react';
import { CheckCircle2, LifeBuoy, ShieldAlert } from 'lucide-react';
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

const HISTORY_STATUSES = new Set(['COMPLETED', 'CLOSED', 'CANCELLED']);

const isHistoryEscalation = (item) => {
  const status = String(item?.status || '').trim().toUpperCase();
  return HISTORY_STATUSES.has(status) || status.includes('ANSWERED');
};

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
  const openSupportCount = review.escalations.filter((item) => !isHistoryEscalation(item)).length;
  const resolvedCount = review.escalations.filter(isHistoryEscalation).length
    + (review.resolvedAnswerReviews?.length || 0);

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
    <div className="portal-section teacher-feature-page teacher-review-feature-page teacher-review-queue-page">
      <PageHeader
        eyebrow="Hỗ trợ & chất lượng AI"
        title={uiCopy.teacher.review.title}
        description={uiCopy.teacher.review.subtitle}
        actions={(
          <div className="teacher-review-header-stats" aria-label="Tổng quan hàng đợi">
            <div>
              <span><LifeBuoy size={16} /></span>
              <strong>{openSupportCount}</strong>
              <small>Hỗ trợ đang mở</small>
            </div>
            <div>
              <span><ShieldAlert size={16} /></span>
              <strong>{answerReviewCount}</strong>
              <small>Phản hồi AI</small>
            </div>
            <div>
              <span><CheckCircle2 size={16} /></span>
              <strong>{resolvedCount}</strong>
              <small>Đã xử lý</small>
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
            label: (
              <span className="teacher-review-tab">
                <LifeBuoy size={15} />
                Hỗ trợ sinh viên
                <em>{review.escalations.length}</em>
              </span>
            ),
            children: (
              <TeacherSupportInbox
                currentUser={currentUser}
                loading={review.isTeacherInboxLoading}
                escalations={review.escalations}
                selectedEscalation={review.selectedEscalation}
                onSelectEscalation={review.setSelectedEscalation}
                onRefresh={() => review.loadTeacherInbox({})}
                onSearch={(q) => review.loadTeacherInbox({ q })}
                onDeleteEscalation={review.hideEscalationFromTeacherInbox}
                deletingEscalationIds={review.deletingEscalationIds}
                reply={reply}
                onReplyChange={setReply}
                replyImages={replyImages}
                onReplyImagesChange={setReplyImages}
                onSubmitAnswer={handleAnswerEscalation}
                onAnswerIndexed={(result) => {
                  if (result?.knowledgeCandidateCreated) {
                    triggerToast('Đã gửi đáp án cho sinh viên và tạo đề xuất tri thức cho senior duyệt.');
                  } else if (result?.knowledgeCandidateAlreadyExists) {
                    triggerToast('Đã gửi đáp án. Đề xuất tri thức cho yêu cầu này đã tồn tại.');
                  } else {
                    triggerToast('Đã gửi đáp án cho sinh viên.');
                  }
                  review.loadTeacherInbox({});
                }}
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
            label: (
              <span className="teacher-review-tab">
                <ShieldAlert size={15} />
                Phản hồi AI
                <em>{answerReviewCount}</em>
              </span>
            ),
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

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Select } from 'antd';
import { Activity, CheckCircle2, LifeBuoy, ShieldAlert } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import AppTabs from '../../../components/common/AppTabs';
import { queryKeys } from '../../../app/queryKeys';
import { uiCopy } from '../../../constants/uiCopy';
import { ACADEMIC_CANDIDATE_TYPES } from '../../../constants/knowledgeFlow';
import { asArray } from '../../../services/normalizers';
import { teacherApi } from '../../../services/teacherApi';
import { uniqueClassScopes } from '../tutoring/teacherTutoringStudents';
import { useTeacherReviewQueue } from './useTeacherReviewQueue';
import AnswerReviewWorkspace from './AnswerReviewWorkspace';
import TeacherSupportInbox from './TeacherSupportInbox';
import AdaptiveLearningReviewPanel from './AdaptiveLearningReviewPanel';
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
  setCourseId,
  setClassId,
  triggerToast,
}) {
  const classesQuery = useQuery({
    queryKey: queryKeys.teacherClasses(teacherId),
    queryFn: async ({ signal }) => asArray(
      await teacherApi.getClassSections(teacherId, { signal }),
      'classes', 'classSections', 'content',
    ),
    enabled: Boolean(teacherId),
    staleTime: 60_000,
  });
  const classScopes = useMemo(
    () => uniqueClassScopes(classesQuery.data || [], { courseId, classId }),
    [classesQuery.data, courseId, classId],
  );
  const currentScope = classScopes.find(
    (scope) => scope.courseId === courseId && scope.classId === classId,
  );

  // Default to the teacher's first assigned class so the student roster and
  // AI labels below have a class to show immediately.
  useEffect(() => {
    if ((!courseId || !classId) && classScopes.length > 0) {
      setCourseId?.(classScopes[0].courseId);
      setClassId?.(classScopes[0].classId);
    }
  }, [courseId, classId, classScopes, setCourseId, setClassId]);

  const handleClassChange = (key) => {
    const scope = classScopes.find((item) => item.key === key);
    if (!scope) return;
    setCourseId?.(scope.courseId);
    setClassId?.(scope.classId);
  };
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
      <div className="teacher-review-class-picker">
        <label className="teacher-review-class-picker__field">
          <span>Lớp học của bạn</span>
          <Select
            value={currentScope?.key}
            placeholder="Chọn lớp học"
            loading={classesQuery.isFetching}
            disabled={classScopes.length === 0}
            options={classScopes.map((scope) => ({ value: scope.key, label: scope.label }))}
            onChange={handleClassChange}
          />
        </label>
        <p>
          {classScopes.length > 0
            ? `Bạn đang phụ trách ${classScopes.length} lớp. Chọn lớp để xem sinh viên, nhãn AI và các yêu cầu cần xử lý của lớp đó.`
            : 'Đang tải danh sách lớp bạn phụ trách...'}
        </p>
      </div>
      {!classesQuery.isFetching && classScopes.length === 0 && (
        <Alert
          type="warning"
          showIcon
          message="Bạn chưa được phân công lớp học nào"
          description="Liên hệ quản trị viên để được gán vào lớp học phần, sau đó quay lại màn hình này để chọn lớp."
        />
      )}
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
            key: 'adaptive-learning',
            label: (
              <span className="teacher-review-tab">
                <Activity size={15} />
                Đánh giá tiến bộ
              </span>
            ),
            children: (
              <AdaptiveLearningReviewPanel
                currentUser={currentUser}
                teacherId={teacherId}
                courseId={courseId}
                classId={classId}
                triggerToast={triggerToast}
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

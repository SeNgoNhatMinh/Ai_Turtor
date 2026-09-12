import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../app/queryKeys';
import { assignmentApi } from '../../../services/assignmentApi';
import { materialsApi } from '../../../services/materialsApi';
import { quizApi } from '../../../services/quizApi';
import { teacherReviewApi } from '../../../services/teacherReviewApi';
import { asArray } from '../../../services/normalizers';
import { canReviewKnowledge } from '../../../utils/permissions';
import { useRealtimeEvent, useRealtimeReconnect } from '../../realtime/realtimeContext';
import { REALTIME_EVENT_TYPES, eventMatchesCourse } from '../../realtime/realtimeEvents';

const EMPTY_LIST = [];
const isClosed = (status) => ['COMPLETED', 'CLOSED', 'RESOLVED', 'RESOLVED_INDEXED', 'REVIEWED']
  .includes(String(status || '').toUpperCase());

const loadActionItems = async ({ teacherId, role, courseId, classId, signal }) => {
  const reviewLoader = canReviewKnowledge(role)
    ? teacherReviewApi.getSeniorPendingAnswerReviews(courseId, { signal })
    : teacherReviewApi.getMentorPendingAnswerReviews(courseId, { signal });
  const results = await Promise.allSettled([
    quizApi.getTeacherQuizAttempts(teacherId, {
      courseId,
      classId,
      status: 'SUBMITTED',
      reviewStatus: 'PENDING',
      page: 0,
      size: 1,
    }, { signal }),
    assignmentApi.getClassSubmissions(courseId, classId, teacherId, { signal }),
    teacherReviewApi.getTeacherEscalations(teacherId, { courseId, classId }, { signal }),
    reviewLoader,
    materialsApi.getCourseMaterials(courseId, classId, { signal }),
  ]);
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  if (results.every((result) => result.status === 'rejected')) {
    throw new Error('Không thể tải hàng chờ công việc. Hãy thử làm mới sau.');
  }
  const value = (index) => results[index].status === 'fulfilled' ? results[index].value : null;
  const quizCount = Number(value(0)?.totalElements || value(0)?.attempts?.length || 0);
  const submissions = asArray(value(1), 'submissions', 'content').filter((item) => !isClosed(item.status));
  const escalations = asArray(value(2), 'escalations', 'inbox', 'content').filter((item) => !isClosed(item.status));
  const reviews = Array.isArray(value(3)) ? value(3) : [];
  const failedMaterials = asArray(value(4), 'materials', 'content').filter((item) => {
    const status = String(item.indexingStatus || item.status || '').toUpperCase();
    return status === 'FAILED' || status === 'INDEXING_FAILED' || status === 'ERROR';
  });

  return [
    quizCount && {
      key: 'quiz-review',
      title: `${quizCount} bài quiz chờ duyệt điểm`,
      description: 'Kiểm tra điểm tự động và xác nhận điểm cuối.',
      status: 'PENDING_REVIEW',
      tab: 'teacher-grading',
    },
    submissions.length && {
      key: 'assignment-review',
      title: `${submissions.length} bài tập tệp chờ chấm`,
      description: 'Xem tệp sinh viên nộp và công bố nhận xét.',
      status: 'SUBMITTED',
      tab: 'teacher-grading',
    },
    escalations.length && {
      key: 'escalations',
      title: `${escalations.length} yêu cầu hỗ trợ đang mở`,
      description: 'Trao đổi và gửi câu trả lời chính thức cho sinh viên.',
      status: 'OPEN',
      tab: 'teacher-escalations',
    },
    reviews.length && {
      key: 'answer-reviews',
      title: `${reviews.length} phản hồi AI cần kiểm tra`,
      description: canReviewKnowledge(role)
        ? 'Xác minh lỗi nghiêm trọng và quyết định có tạo tri thức dùng lại.'
        : 'Kiểm tra phản hồi của sinh viên về câu trả lời AI.',
      status: canReviewKnowledge(role) ? 'NEEDS_SENIOR_REVIEW' : 'NEEDS_MENTOR_REVIEW',
      tab: 'teacher-escalations',
    },
    failedMaterials.length && {
      key: 'failed-materials',
      title: `${failedMaterials.length} học liệu lập chỉ mục thất bại`,
      description: 'Xem lỗi và yêu cầu lập chỉ mục lại.',
      status: 'INDEXING_FAILED',
      tab: 'teacher-materials',
    },
  ].filter(Boolean);
};

export function useTeacherActionCenter({ teacherId, role, courseId, classId }) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.teacherActionCenter(teacherId, role, courseId, classId);
  const hasScope = Boolean(teacherId && courseId && classId);
  const actionCenterQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => loadActionItems({ teacherId, role, courseId, classId, signal }),
    enabled: hasScope,
    staleTime: 15_000,
  });

  const load = useCallback(() => actionCenterQuery.refetch(), [actionCenterQuery]);
  const invalidate = useCallback(() => {
    if (hasScope) queryClient.invalidateQueries({ queryKey, exact: true });
  }, [hasScope, queryClient, queryKey]);

  useRealtimeEvent([
    ...REALTIME_EVENT_TYPES.material,
    ...REALTIME_EVENT_TYPES.teacherAssignment,
    ...REALTIME_EVENT_TYPES.assignmentAiGrading,
  ], (event) => {
    if (eventMatchesCourse(event, courseId)) invalidate();
  });
  useRealtimeReconnect(invalidate);

  return {
    items: hasScope ? actionCenterQuery.data || EMPTY_LIST : EMPTY_LIST,
    loading: hasScope && (actionCenterQuery.isPending || actionCenterQuery.isFetching),
    error: actionCenterQuery.error?.message || '',
    load,
  };
}

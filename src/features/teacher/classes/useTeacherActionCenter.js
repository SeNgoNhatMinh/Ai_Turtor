import { useCallback, useEffect, useState } from 'react';
import { assignmentApi } from '../../../services/assignmentApi';
import { materialsApi } from '../../../services/materialsApi';
import { quizApi } from '../../../services/quizApi';
import { teacherReviewApi } from '../../../services/teacherReviewApi';
import { asArray } from '../../../services/normalizers';
import { canReviewKnowledge } from '../../../utils/permissions';
import { useRealtimeEvent, useRealtimeReconnect } from '../../realtime/realtimeContext';
import { REALTIME_EVENT_TYPES, eventMatchesCourse } from '../../realtime/realtimeEvents';

const isClosed = (status) => ['COMPLETED', 'CLOSED', 'RESOLVED', 'RESOLVED_INDEXED', 'REVIEWED']
  .includes(String(status || '').toUpperCase());

export function useTeacherActionCenter({ teacherId, role, courseId, classId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!teacherId || !courseId || !classId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError('');
    const reviewLoader = canReviewKnowledge(role)
      ? teacherReviewApi.getSeniorPendingAnswerReviews(courseId)
      : teacherReviewApi.getMentorPendingAnswerReviews(courseId);
    const results = await Promise.allSettled([
      quizApi.getTeacherQuizAttempts(teacherId, {
        courseId,
        classId,
        status: 'SUBMITTED',
        reviewStatus: 'PENDING',
        page: 0,
        size: 1,
      }),
      assignmentApi.getClassSubmissions(courseId, classId, teacherId),
      teacherReviewApi.getTeacherEscalations(teacherId, { courseId, classId }),
      reviewLoader,
      materialsApi.getCourseMaterials(courseId, classId, { force: true }),
    ]);
    const value = (index) => results[index].status === 'fulfilled' ? results[index].value : null;
    if (results.every((result) => result.status === 'rejected')) {
      setItems([]);
      setError('Không thể tải hàng chờ công việc. Hãy thử làm mới sau.');
      setLoading(false);
      return;
    }

    const quizCount = Number(value(0)?.totalElements || value(0)?.attempts?.length || 0);
    const submissions = asArray(value(1), 'submissions', 'content').filter((item) => !isClosed(item.status));
    const escalations = asArray(value(2), 'escalations', 'inbox', 'content').filter((item) => !isClosed(item.status));
    const reviews = Array.isArray(value(3)) ? value(3) : [];
    const failedMaterials = asArray(value(4), 'materials', 'content').filter((item) => {
      const status = String(item.indexingStatus || item.status || '').toUpperCase();
      return status === 'FAILED' || status === 'INDEXING_FAILED' || status === 'ERROR';
    });

    setItems([
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
    ].filter(Boolean));
    setLoading(false);
  }, [classId, courseId, role, teacherId]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useRealtimeEvent([
    ...REALTIME_EVENT_TYPES.material,
    ...REALTIME_EVENT_TYPES.teacherAssignment,
    ...REALTIME_EVENT_TYPES.assignmentAiGrading,
  ], (event) => {
    if (eventMatchesCourse(event, courseId)) load();
  });
  useRealtimeReconnect(load);

  return { items, loading, error, load };
}

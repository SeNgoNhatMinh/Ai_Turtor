import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../app/queryKeys';
import { quizApi } from '../../../services/quizApi';
import { getUserFacingError } from '../../../services/apiClient';
import { normalizeQuizSession } from '../../../services/normalizers';
import { useMutationLock } from '../../../hooks/useMutationLock';
import { useRealtimeEvent, useRealtimeReconnect } from '../../realtime/realtimeContext';
import { REALTIME_EVENT_TYPES } from '../../realtime/realtimeEvents';

const EMPTY_ATTEMPT_PAGE = {
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
};

export function useTeacherGrading({ teacherId, courseId, classId, teacherStudents, triggerToast }) {
  const queryClient = useQueryClient();
  const [quizPage, setQuizPage] = useState(0);
  const [quizReviewStatus, setQuizReviewStatusState] = useState('PENDING');
  const [loadingQuizDetailId, setLoadingQuizDetailId] = useState('');
  const [selectedTeacherSubState, setSelectedTeacherSub] = useState(null);
  const { runLocked, lockedKeys } = useMutationLock();
  const hasScope = Boolean(teacherId && courseId && classId);
  const quizQueryKey = queryKeys.teacherGradingQuizzes(
    teacherId,
    courseId,
    classId,
    quizReviewStatus,
    quizPage,
  );
  const studentLookup = useMemo(
    () => new Map((teacherStudents || []).map((student) => [student.id, student])),
    [teacherStudents],
  );

  const quizSubmissionsQuery = useQuery({
    queryKey: quizQueryKey,
    queryFn: ({ signal }) => quizApi.getTeacherQuizAttempts(teacherId, {
      status: 'SUBMITTED',
      reviewStatus: quizReviewStatus || undefined,
      courseId,
      classId,
      page: quizPage,
      size: 20,
    }, { signal }),
    enabled: hasScope,
    staleTime: 15_000,
  });

  const quizSubmissions = useMemo(() => (
    (quizSubmissionsQuery.data?.attempts || []).map((attempt) => {
      const student = studentLookup.get(attempt.studentId);
      return {
        ...attempt,
        studentName: student?.name || student?.fullName || attempt.studentName,
        studentEmail: student?.email || attempt.studentEmail,
      };
    })
  ), [quizSubmissionsQuery.data?.attempts, studentLookup]);
  const quizAttemptPage = quizSubmissionsQuery.data ? {
    page: quizSubmissionsQuery.data.page,
    size: quizSubmissionsQuery.data.size,
    totalElements: quizSubmissionsQuery.data.totalElements,
    totalPages: quizSubmissionsQuery.data.totalPages,
  } : EMPTY_ATTEMPT_PAGE;
  const selectedTeacherSub = useMemo(() => {
    if (!hasScope) return null;
    const selectedId = selectedTeacherSubState?.id;
    if (!selectedId) return null;
    const currentQuiz = quizSubmissions.find((attempt) => attempt.id === selectedId);
    if (currentQuiz) return { ...currentQuiz, ...selectedTeacherSubState };
    return quizSubmissionsQuery.isPending ? selectedTeacherSubState : null;
  }, [
    hasScope,
    quizSubmissions,
    quizSubmissionsQuery.isPending,
    selectedTeacherSubState,
  ]);

  useEffect(() => {
    if (!quizSubmissionsQuery.error) return;
    triggerToast(getUserFacingError(
      quizSubmissionsQuery.error,
      'Không thể tải danh sách lượt làm quiz cần duyệt.',
    ), 'error');
  }, [quizSubmissionsQuery.error, triggerToast]);

  const loadQuizSubmissions = useCallback(
    () => quizSubmissionsQuery.refetch(),
    [quizSubmissionsQuery],
  );
  const invalidateGrading = useCallback(() => {
    if (!hasScope) return;
    queryClient.invalidateQueries({ queryKey: ['teacher', 'grading', 'quizzes', teacherId, courseId, classId] });
  }, [classId, courseId, hasScope, queryClient, teacherId]);

  useRealtimeEvent(REALTIME_EVENT_TYPES.quizHistory, invalidateGrading);
  useRealtimeReconnect(invalidateGrading);

  const setQuizReviewStatus = (status) => {
    setQuizReviewStatusState(status);
    setQuizPage(0);
    setSelectedTeacherSub(null);
  };

  const selectQuizSubmission = async (attempt) => {
    const quizSessionId = attempt?.quizSessionId || attempt?.id;
    if (!quizSessionId) return attempt;
    setSelectedTeacherSub(attempt);
    setLoadingQuizDetailId(quizSessionId);
    try {
      const detail = await queryClient.fetchQuery({
        queryKey: queryKeys.quizDetail(quizSessionId),
        queryFn: ({ signal }) => quizApi.getQuiz(quizSessionId, { signal }),
        staleTime: 30_000,
      });
      const merged = normalizeQuizSession({ ...attempt, ...detail });
      setSelectedTeacherSub(merged);
      return merged;
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể tải lượt làm quiz này.'), 'error');
      return attempt;
    } finally {
      setLoadingQuizDetailId('');
    }
  };

  const handleTeacherQuizReview = async (quizSessionId, reviewedScore, feedback) => {
    return runLocked(`quiz-review:${quizSessionId}`, async () => {
      try {
        await quizApi.teacherReviewQuiz(quizSessionId, {
          teacherId,
          reviewedScore: Number(reviewedScore),
          feedback,
        });
        triggerToast('Đã lưu kết quả duyệt quiz.');
        queryClient.setQueriesData({
          queryKey: ['teacher', 'grading', 'quizzes', teacherId, courseId, classId],
        }, (current) => current ? {
          ...current,
          attempts: (current.attempts || []).map((quiz) => (
            quiz.id === quizSessionId
              ? {
                  ...quiz,
                  teacherReviewedScore: Number(reviewedScore),
                  finalScore: Number(reviewedScore),
                  finalPercentage: quiz.maxScore
                    ? Math.round((Number(reviewedScore) * 10000) / quiz.maxScore) / 100
                    : 0,
                  teacherFeedback: feedback,
                  teacherReviewStatus: 'REVIEWED',
                }
              : quiz
          )),
        } : current);
        setSelectedTeacherSub((current) => current?.id === quizSessionId ? {
          ...current,
          teacherReviewedScore: Number(reviewedScore),
          finalScore: Number(reviewedScore),
          teacherFeedback: feedback,
          teacherReviewStatus: 'REVIEWED',
        } : current);
        if (quizReviewStatus === 'PENDING') {
          await loadQuizSubmissions();
        } else {
          await queryClient.invalidateQueries({ queryKey: quizQueryKey, exact: true });
        }
        return true;
      } catch (error) {
        triggerToast(getUserFacingError(error, 'Không thể lưu kết quả duyệt quiz.'), 'error');
        return false;
      }
    });
  };

  return {
    quizSubmissions,
    quizAttemptPage,
    quizPage,
    setQuizPage,
    quizReviewStatus,
    setQuizReviewStatus,
    isQuizSubmissionsLoading: hasScope
      && (quizSubmissionsQuery.isPending || quizSubmissionsQuery.isFetching),
    loadingQuizDetailId,
    selectedTeacherSub,
    setSelectedTeacherSub,
    selectQuizSubmission,
    loadQuizSubmissions,
    handleTeacherQuizReview,
    gradingMutationKeys: lockedKeys,
  };
}

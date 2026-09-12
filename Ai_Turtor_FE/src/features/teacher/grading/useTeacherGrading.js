import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../app/queryKeys';
import { assignmentApi } from '../../../services/assignmentApi';
import { assignmentGradingGateway } from '../../ai-harness/assignmentGradingGateway';
import { quizApi } from '../../../services/quizApi';
import { getUserFacingError } from '../../../services/apiClient';
import {
  asArray,
  normalizeAssignment,
  normalizeAssignmentSubmission,
  normalizeQuizSession,
} from '../../../services/normalizers';
import { validateAnswerKeyFile } from '../../../utils/assignmentFiles';
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
  const [answerKeyUploadingId, setAnswerKeyUploadingId] = useState('');
  const [aiGradingSubmissionId, setAiGradingSubmissionId] = useState('');
  const { runLocked, lockedKeys } = useMutationLock();
  const hasScope = Boolean(teacherId && courseId && classId);
  const assignmentQueryKey = queryKeys.teacherGradingAssignments(teacherId, courseId, classId);
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

  const assignmentSubmissionsQuery = useQuery({
    queryKey: assignmentQueryKey,
    queryFn: async ({ signal }) => {
      const [submissionData, assignmentData] = await Promise.all([
        assignmentApi.getClassSubmissions(courseId, classId, teacherId, { signal }),
        assignmentApi.getClassAssignments(courseId, classId, teacherId, { signal }),
      ]);
      const assignments = asArray(assignmentData, 'content', 'assignments').map(normalizeAssignment);
      const assignmentsById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
      return asArray(submissionData, 'content', 'submissions').map((rawSubmission) => {
        const submission = normalizeAssignmentSubmission(rawSubmission);
        const assignment = assignmentsById.get(submission.assignmentId)
          || normalizeAssignment(rawSubmission.assignment);
        return {
          ...assignment,
          ...submission,
          id: submission.id,
          submissionId: submission.id,
          assignment,
        };
      });
    },
    enabled: hasScope,
    staleTime: 15_000,
  });
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

  const teacherSubmissions = useMemo(() => (
    (assignmentSubmissionsQuery.data || []).map((submission) => {
      const student = studentLookup.get(submission.studentId || submission.userId);
      return {
        ...submission,
        studentName: student?.name || student?.fullName || submission.studentName,
        studentEmail: student?.email || submission.studentEmail,
      };
    })
  ), [assignmentSubmissionsQuery.data, studentLookup]);
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
    const selectedId = selectedTeacherSubState?.submissionId || selectedTeacherSubState?.id;
    if (selectedTeacherSubState?.quizSessionId) {
      const currentQuiz = quizSubmissions.find((attempt) => attempt.id === selectedId);
      if (currentQuiz) return { ...currentQuiz, ...selectedTeacherSubState };
      return quizSubmissionsQuery.isPending ? selectedTeacherSubState : null;
    }
    const currentSubmission = teacherSubmissions.find((submission) => submission.id === selectedId);
    if (currentSubmission) return { ...currentSubmission, ...selectedTeacherSubState };
    if (assignmentSubmissionsQuery.isPending) return selectedTeacherSubState;
    return teacherSubmissions[0] || null;
  }, [
    assignmentSubmissionsQuery.isPending,
    hasScope,
    quizSubmissions,
    quizSubmissionsQuery.isPending,
    selectedTeacherSubState,
    teacherSubmissions,
  ]);

  useEffect(() => {
    if (!quizSubmissionsQuery.error) return;
    triggerToast(getUserFacingError(
      quizSubmissionsQuery.error,
      'Không thể tải danh sách lượt làm quiz cần duyệt.',
    ));
  }, [quizSubmissionsQuery.error, triggerToast]);

  const loadTeacherSubmissions = useCallback(
    () => assignmentSubmissionsQuery.refetch(),
    [assignmentSubmissionsQuery],
  );
  const loadQuizSubmissions = useCallback(
    () => quizSubmissionsQuery.refetch(),
    [quizSubmissionsQuery],
  );
  const invalidateGrading = useCallback(() => {
    if (!hasScope) return;
    queryClient.invalidateQueries({ queryKey: assignmentQueryKey, exact: true });
    queryClient.invalidateQueries({ queryKey: ['teacher', 'grading', 'quizzes', teacherId, courseId, classId] });
  }, [assignmentQueryKey, classId, courseId, hasScope, queryClient, teacherId]);

  useRealtimeEvent([
    ...REALTIME_EVENT_TYPES.teacherAssignment,
    ...REALTIME_EVENT_TYPES.assignmentAiGrading,
  ], invalidateGrading);
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
      triggerToast(getUserFacingError(error, 'Không thể tải lượt làm quiz này.'));
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
        triggerToast(getUserFacingError(error, 'Không thể lưu kết quả duyệt quiz.'));
        return false;
      }
    });
  };

  const handleTeacherGradeSubmit = async (submissionId, score, feedback, weakTopics) => {
    return runLocked(`assignment-review:${submissionId}`, async () => {
      triggerToast('Đang lưu kết quả chấm bài...');
      try {
        await assignmentApi.gradeSubmission(submissionId, {
          teacherId,
          score: parseFloat(score),
          teacherFeedback: feedback,
          weakTopics,
        });
        triggerToast('Đã lưu điểm bài nộp.');
        await loadTeacherSubmissions();
        return true;
      } catch (error) {
        console.error('Error grading submission:', error);
        triggerToast(getUserFacingError(error, 'Không thể lưu kết quả chấm bài.'));
        return false;
      }
    });
  };

  const handleUploadAnswerKey = async (assignmentId, file) => {
    const validation = validateAnswerKeyFile(file);
    if (!validation.ok) {
      triggerToast(validation.message);
      return false;
    }
    if (!assignmentId || !teacherId) return false;

    return runLocked(`assignment:answer-key:${assignmentId}`, async () => {
      setAnswerKeyUploadingId(assignmentId);
      try {
        await assignmentApi.uploadAssignmentAnswerKey(assignmentId, teacherId, file);
        triggerToast('Đã tải đáp án. Tệp này chỉ giảng viên và backend được truy cập.');
        await loadTeacherSubmissions();
        return true;
      } catch (error) {
        triggerToast(getUserFacingError(error, 'Không thể tải đáp án.'));
        return false;
      } finally {
        setAnswerKeyUploadingId('');
      }
    });
  };

  const handleAiGradeSubmission = async (submission) => {
    const submissionId = submission?.submissionId || submission?.id;
    if (!submissionId || !teacherId) return false;
    if (!submission?.answerKeyUploaded) {
      triggerToast('Hãy tải đáp án trước khi yêu cầu AI hỗ trợ chấm.');
      return false;
    }

    return runLocked(`assignment:ai-grade:${submissionId}`, async () => {
      setAiGradingSubmissionId(submissionId);
      try {
        const response = await assignmentGradingGateway.gradeSubmission({ submissionId, teacherId });
        const result = normalizeAssignmentSubmission(response?.submission || response?.result || response);
        setSelectedTeacherSub((current) => current?.id === submissionId
          ? { ...current, ...result, id: submissionId, submissionId }
          : current);
        triggerToast('Điểm gợi ý của AI đã sẵn sàng. Hãy kiểm tra trước khi lưu điểm cuối.');
        await loadTeacherSubmissions();
        return true;
      } catch (error) {
        triggerToast(getUserFacingError(error, 'AI không thể hoàn tất gợi ý chấm bài. Chưa có điểm cuối nào được lưu.'));
        return false;
      } finally {
        setAiGradingSubmissionId('');
      }
    });
  };

  return {
    teacherSubmissions,
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
    loadTeacherSubmissions,
    loadQuizSubmissions,
    handleTeacherQuizReview,
    handleTeacherGradeSubmit,
    answerKeyUploadingId,
    aiGradingSubmissionId,
    gradingMutationKeys: lockedKeys,
    handleUploadAnswerKey,
    handleAiGradeSubmission,
  };
}

import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../app/queryKeys';
import { getFeedbackRecordedMessage } from '../../../constants/answerReview';
import { getUserFacingError } from '../../../services/apiClient';
import { N8N_ENABLED, N8N_STRICT } from '../../../services/n8nClient';
import { n8nService } from '../../../services/n8nService';
import { normalizeStudentDashboard, normalizeSuggestions } from '../../../services/normalizers';
import { studentLearningApi } from '../../../services/studentLearningApi';
import { teacherReviewApi } from '../../../services/teacherReviewApi';
import {
  mergeSuggestionLists,
  readAnalyzedSuggestions,
  writeAnalyzedSuggestions,
} from '../../../utils/storage';

const EMPTY_DASHBOARD = Object.freeze({
  learnedTopics: [],
  weakTopics: [],
  pinnedImproveSuggestions: [],
  stats: {},
});

const readCachedSuggestions = (studentId, courseId) => (
  normalizeSuggestions(readAnalyzedSuggestions(studentId, courseId))
);

const loadStudentLearning = async ({ studentId, courseId, classId, signal }) => {
  const [dashboardResult, memoryResult] = await Promise.allSettled([
    studentLearningApi.getStudentDashboard(studentId, courseId, {
      signal,
      skipUnauthorizedRedirect: true,
    }),
    studentLearningApi.getStudentMemory(studentId, courseId, {
      signal,
      skipUnauthorizedRedirect: true,
    }),
  ]);

  if (signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  if (dashboardResult.status === 'rejected' && memoryResult.status === 'rejected') {
    throw dashboardResult.reason || memoryResult.reason;
  }

  const normalizedDashboard = dashboardResult.status === 'fulfilled'
    ? normalizeStudentDashboard(dashboardResult.value)
    : EMPTY_DASHBOARD;
  const memorySnapshot = memoryResult.status === 'fulfilled' ? memoryResult.value : null;
  const normalizedMemory = memorySnapshot
    ? normalizeStudentDashboard(memorySnapshot)
    : EMPTY_DASHBOARD;
  const base = dashboardResult.status === 'fulfilled' ? normalizedDashboard : normalizedMemory;
  const mergedPinnedSuggestions = [
    ...(base.pinnedImproveSuggestions || []),
    ...(memorySnapshot?.pinnedImproveSuggestions || normalizedMemory.pinnedImproveSuggestions || []),
  ];
  const suggestions = mergeSuggestionLists(
    base.suggestions || normalizedMemory.suggestions || [],
    readCachedSuggestions(studentId, courseId),
  );

  return {
    dashboard: {
      ...EMPTY_DASHBOARD,
      ...base,
      learnedTopics: memorySnapshot?.learnedTopics?.length
        ? memorySnapshot.learnedTopics
        : base.learnedTopics,
      weakTopics: memorySnapshot?.weakTopics?.length
        ? memorySnapshot.weakTopics
        : base.weakTopics,
      pinnedImproveSuggestions: [...new Set(mergedPinnedSuggestions)],
      summary: memorySnapshot?.summary || base.summary || '',
      classId: memorySnapshot?.classId || base.classId || classId,
      recentQuestions: memorySnapshot?.recentQuestions || base.recentQuestions || [],
      recentAnswers: memorySnapshot?.recentAnswers || base.recentAnswers || [],
      updatedAt: memorySnapshot?.updatedAt || base.updatedAt || '',
    },
    suggestions,
  };
};

export function useStudentLearningController({
  studentId,
  courseId,
  classId,
  triggerToast,
}) {
  const learningQuery = useQuery({
    queryKey: queryKeys.studentLearning(studentId, courseId),
    queryFn: ({ signal }) => loadStudentLearning({
      studentId,
      courseId,
      classId,
      signal,
    }),
    enabled: Boolean(studentId && courseId),
    staleTime: 30_000,
    retry: 1,
  });
  const refetchLearning = learningQuery.refetch;
  const studentDashboard = learningQuery.data?.dashboard || EMPTY_DASHBOARD;
  const suggestions = useMemo(
    () => learningQuery.data?.suggestions || readCachedSuggestions(studentId, courseId),
    [courseId, learningQuery.data?.suggestions, studentId],
  );

  useEffect(() => {
    if (!studentId || !courseId || !learningQuery.data?.suggestions) return;
    writeAnalyzedSuggestions(studentId, courseId, learningQuery.data.suggestions);
  }, [courseId, learningQuery.data?.suggestions, studentId]);

  const loadStudentDashboard = useCallback(async () => {
    if (!studentId || !courseId) return null;
    const result = await refetchLearning();
    return result.data?.dashboard || null;
  }, [courseId, refetchLearning, studentId]);

  const reviewMutation = useMutation({
    mutationFn: async (reviewPayload) => {
      if (N8N_ENABLED) {
        try {
          return await n8nService.submitAnswerReview(reviewPayload);
        } catch (n8nError) {
          if (N8N_STRICT) throw n8nError;
          console.warn('n8n feedback failed, falling back to backend API:', n8nError);
        }
      }
      return teacherReviewApi.submitAnswerReview(reviewPayload);
    },
  });

  const handleStudentReviewAnswer = useCallback(async (reviewPayload) => {
    triggerToast('Đang gửi phản hồi...');
    try {
      const response = await reviewMutation.mutateAsync(reviewPayload);
      triggerToast(getFeedbackRecordedMessage(response));
      return response;
    } catch (error) {
      console.error('Error submitting feedback:', error);
      triggerToast(getUserFacingError(error, 'Không thể gửi phản hồi. Vui lòng thử lại.'));
      return null;
    }
  }, [reviewMutation, triggerToast]);

  return {
    studentDashboard,
    suggestions,
    isLearningLoading: learningQuery.isPending,
    learningError: learningQuery.error
      ? getUserFacingError(learningQuery.error, 'Không thể tải tiến độ học tập.')
      : '',
    loadStudentDashboard,
    handleStudentReviewAnswer,
  };
}

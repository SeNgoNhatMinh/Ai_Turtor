import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../app/queryKeys';
import { adminAcademicApi } from '../../../services/adminAcademicApi';
import { expertTrainingApi } from '../../../services/expertTrainingApi';
import { normalizeCourseOption } from '../../../services/expertTrainingNormalizers';
import { getUserFacingError } from '../../../services/httpClient';
import { materialsApi } from '../../../services/materialsApi';
import { asArray } from '../../../services/normalizers';
import { teacherApi } from '../../../services/teacherApi';
import {
  getTutorV2Role,
  isPdfMaterialSource,
  isTutorV2Reviewer,
} from '../expertTrainingUtils';
import { useExpertTrainingRealtimeRefresh } from './useExpertTrainingRealtimeRefresh';

const EMPTY_LIST = [];

const errorMessage = (error, fallback = 'Không thể tải dữ liệu Tutor V2.') => (
  error ? getUserFacingError(error, fallback) : ''
);

export function useExpertTrainingResources({
  currentUser,
  courseId,
  selectedTaskId = '',
  setCourseId,
  triggerToast,
  mode = 'auto',
  mutationActive = false,
}) {
  const queryClient = useQueryClient();
  const userId = currentUser?.userId || currentUser?.id || '';
  const reviewerRole = getTutorV2Role(currentUser);
  const canReview = isTutorV2Reviewer(currentUser);
  const resourceMode = mode === 'auto' ? (canReview ? 'reviewer' : 'teacher') : mode;
  const [chapterPreviewRequest, setChapterPreviewRequest] = useState(null);
  const [taskMaterialChapter, setTaskMaterialChapter] = useState('');
  const [evaluationRunId, setEvaluationRunId] = useState('');

  const coursesQuery = useQuery({
    queryKey: queryKeys.expertCourses(userId, resourceMode),
    queryFn: async ({ signal }) => {
      const items = resourceMode === 'teacher'
        ? await teacherApi.getCourses(userId, { signal })
        : await adminAcademicApi.getCourses({ signal });
      return asArray(items, 'courses', 'content')
        .map(normalizeCourseOption)
        .filter((item) => item.id);
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
  const chaptersQuery = useQuery({
    queryKey: queryKeys.expertChapters(courseId),
    queryFn: ({ signal }) => expertTrainingApi.getSuggestedChapters(courseId, { signal }),
    enabled: Boolean(courseId && resourceMode !== 'teacher'),
    staleTime: 30_000,
  });
  const gapsQuery = useQuery({
    queryKey: queryKeys.expertCoverageGaps(courseId),
    queryFn: ({ signal }) => expertTrainingApi.getCoverageGaps(courseId, { signal }),
    enabled: Boolean(courseId && resourceMode !== 'teacher'),
    staleTime: 30_000,
  });
  const tasksQuery = useQuery({
    queryKey: queryKeys.expertTasks(courseId),
    queryFn: ({ signal }) => expertTrainingApi.getTasks({ courseId }, { signal }),
    enabled: Boolean(courseId),
    staleTime: 15_000,
  });
  const contributionsQuery = useQuery({
    queryKey: queryKeys.expertContributions(courseId),
    queryFn: async ({ signal }) => {
      const [goldQa, rubrics] = await Promise.all([
        expertTrainingApi.getGoldQa(courseId, {}, { signal }),
        expertTrainingApi.getRubrics(courseId, { signal }),
      ]);
      return { goldQa, rubrics };
    },
    enabled: Boolean(courseId),
    staleTime: 15_000,
  });
  const evaluationQuery = useQuery({
    queryKey: queryKeys.expertEvaluations(courseId),
    queryFn: ({ signal }) => expertTrainingApi.getEvaluationRuns(courseId, { signal }),
    enabled: Boolean(courseId && resourceMode !== 'teacher'),
    staleTime: 30_000,
  });

  const chapterPreviewKey = chapterPreviewRequest?.chapterKey
    || chapterPreviewRequest?.title
    || '';
  const chapterPreviewQuery = useQuery({
    queryKey: queryKeys.expertChapterPreview(
      courseId,
      chapterPreviewKey,
      chapterPreviewRequest?.expanded,
    ),
    queryFn: ({ signal }) => chapterPreviewRequest.chapterKey
      ? expertTrainingApi.getChapterPreview(
        chapterPreviewRequest.chapterKey,
        courseId,
        chapterPreviewRequest.expanded,
        { signal },
      )
      : expertTrainingApi.getChapterPreviewByTitle(
        courseId,
        chapterPreviewRequest.title,
        chapterPreviewRequest.expanded,
        { signal },
      ),
    enabled: Boolean(courseId && chapterPreviewRequest && chapterPreviewKey),
    staleTime: 60_000,
  });
  const taskMaterialQuery = useQuery({
    queryKey: queryKeys.expertTaskMaterial(courseId, taskMaterialChapter),
    queryFn: ({ signal }) => expertTrainingApi.getChapterPreviewByTitle(
      courseId,
      taskMaterialChapter,
      false,
      { signal },
    ),
    enabled: Boolean(courseId && taskMaterialChapter),
    staleTime: 60_000,
  });
  const evaluationDetailQuery = useQuery({
    queryKey: queryKeys.expertEvaluationDetail(evaluationRunId),
    queryFn: ({ signal }) => expertTrainingApi.getEvaluationRun(evaluationRunId, { signal }),
    enabled: Boolean(evaluationRunId),
    staleTime: 60_000,
  });

  const courses = coursesQuery.data || EMPTY_LIST;
  const resources = useMemo(() => ({
    chapters: chaptersQuery.data || EMPTY_LIST,
    gaps: gapsQuery.data || EMPTY_LIST,
    tasks: tasksQuery.data || EMPTY_LIST,
    goldQa: contributionsQuery.data?.goldQa || EMPTY_LIST,
    rubrics: contributionsQuery.data?.rubrics || EMPTY_LIST,
    evalRuns: evaluationQuery.data || EMPTY_LIST,
  }), [
    chaptersQuery.data,
    contributionsQuery.data,
    evaluationQuery.data,
    gapsQuery.data,
    tasksQuery.data,
  ]);
  const loading = {
    courses: Boolean(userId) && (coursesQuery.isPending || coursesQuery.isFetching),
    chapters: Boolean(courseId && resourceMode !== 'teacher')
      && (chaptersQuery.isPending || chaptersQuery.isFetching),
    chapterPreview: Boolean(chapterPreviewRequest)
      && (chapterPreviewQuery.isPending || chapterPreviewQuery.isFetching),
    taskMaterial: Boolean(taskMaterialChapter)
      && (taskMaterialQuery.isPending || taskMaterialQuery.isFetching),
    gaps: Boolean(courseId && resourceMode !== 'teacher')
      && (gapsQuery.isPending || gapsQuery.isFetching),
    tasks: Boolean(courseId) && (tasksQuery.isPending || tasksQuery.isFetching),
    contributions: Boolean(courseId)
      && (contributionsQuery.isPending || contributionsQuery.isFetching),
    evaluation: Boolean(courseId && resourceMode !== 'teacher')
      && (evaluationQuery.isPending || evaluationQuery.isFetching),
  };
  const errors = {
    courses: errorMessage(coursesQuery.error),
    chapters: errorMessage(chaptersQuery.error),
    chapterPreview: errorMessage(chapterPreviewQuery.error, 'Không thể tải nội dung chương.'),
    taskMaterial: errorMessage(taskMaterialQuery.error, 'Không thể tải tài liệu chương.'),
    gaps: errorMessage(gapsQuery.error),
    tasks: errorMessage(tasksQuery.error),
    contributions: errorMessage(contributionsQuery.error),
    evaluation: errorMessage(evaluationQuery.error),
  };

  useEffect(() => {
    if (!courses.length || courses.some((item) => item.id === courseId)) return;
    setCourseId(courses[0].id);
  }, [courseId, courses, setCourseId]);

  const loadCourses = useCallback(() => coursesQuery.refetch(), [coursesQuery]);
  const loadGaps = useCallback(() => (
    courseId ? gapsQuery.refetch() : Promise.resolve([])
  ), [courseId, gapsQuery]);
  const loadChapters = useCallback(() => (
    courseId ? chaptersQuery.refetch() : Promise.resolve([])
  ), [chaptersQuery, courseId]);
  const loadTasks = useCallback(() => (
    courseId ? tasksQuery.refetch() : Promise.resolve([])
  ), [courseId, tasksQuery]);
  const loadContributions = useCallback(() => (
    courseId ? contributionsQuery.refetch() : Promise.resolve([])
  ), [contributionsQuery, courseId]);
  const loadEvaluation = useCallback(() => (
    courseId ? evaluationQuery.refetch() : Promise.resolve([])
  ), [courseId, evaluationQuery]);

  const refreshChapters = useCallback(async () => {
    if (!courseId) return [];
    try {
      const items = await expertTrainingApi.refreshChapters(courseId);
      queryClient.setQueryData(queryKeys.expertChapters(courseId), items);
      triggerToast?.(`Đã làm mới mục lục: ${items?.length || 0} chương.`);
      return items;
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể làm mới mục lục.'));
      return [];
    }
  }, [courseId, queryClient, triggerToast]);

  const refreshAll = useCallback(async () => {
    if (!courseId) return;
    const loaders = resourceMode === 'teacher'
      ? [loadTasks(), loadContributions()]
      : [loadChapters(), loadGaps(), loadTasks(), loadContributions(), loadEvaluation()];
    await Promise.allSettled(loaders);
  }, [
    courseId,
    loadChapters,
    loadContributions,
    loadEvaluation,
    loadGaps,
    loadTasks,
    resourceMode,
  ]);
  const refreshLive = useCallback(async () => {
    if (!courseId) return;
    await Promise.allSettled([loadTasks(), loadContributions()]);
  }, [courseId, loadContributions, loadTasks]);

  const connectionState = useExpertTrainingRealtimeRefresh({
    courseId,
    resourceMode,
    mutationActive,
    refreshAll,
    refreshLive,
    loadChapters,
    loadContributions,
    loadTasks,
  });

  const selectedTask = useMemo(
    () => resources.tasks.find((task) => task.id === selectedTaskId) || null,
    [resources.tasks, selectedTaskId],
  );
  const selectedTaskContributions = useMemo(() => {
    if (!selectedTask) return [];
    return resources.goldQa
      .filter((item) => item.sourceTaskId === selectedTask.id)
      .sort((left, right) => (
        new Date(left.createdAt || left.updatedAt || 0)
        - new Date(right.createdAt || right.updatedAt || 0)
      ));
  }, [resources.goldQa, selectedTask]);
  const selectedTaskContribution = selectedTaskContributions[selectedTaskContributions.length - 1] || null;
  const selectedTaskRejection = selectedTaskContributions.find((item) => item.status === 'REJECTED') || null;
  const pendingReviewCount = useMemo(() => (
    resources.goldQa.filter((item) => item.status === 'PENDING_REVIEW').length
    + resources.rubrics.filter((item) => item.status === 'PENDING_REVIEW').length
  ), [resources.goldQa, resources.rubrics]);

  const openChapterPreview = useCallback(async (chapter, expanded = false) => {
    const request = {
      chapterKey: chapter?.chapterKey || chapter?.id || '',
      title: chapter?.title || chapter?.chapter || '',
      expanded,
    };
    const key = request.chapterKey || request.title;
    if (!courseId || !key) return null;
    setChapterPreviewRequest(request);
    try {
      return await queryClient.fetchQuery({
        queryKey: queryKeys.expertChapterPreview(courseId, key, expanded),
        queryFn: ({ signal }) => request.chapterKey
          ? expertTrainingApi.getChapterPreview(request.chapterKey, courseId, expanded, { signal })
          : expertTrainingApi.getChapterPreviewByTitle(courseId, request.title, expanded, { signal }),
        staleTime: 60_000,
      });
    } catch {
      return null;
    }
  }, [courseId, queryClient]);

  const setChapterPreview = useCallback((value) => {
    if (!value) setChapterPreviewRequest(null);
  }, []);
  const loadTaskMaterialPreview = useCallback(async (chapter) => {
    if (!courseId || !chapter) {
      setTaskMaterialChapter('');
      return null;
    }
    setTaskMaterialChapter(chapter);
    try {
      return await queryClient.fetchQuery({
        queryKey: queryKeys.expertTaskMaterial(courseId, chapter),
        queryFn: ({ signal }) => expertTrainingApi.getChapterPreviewByTitle(
          courseId,
          chapter,
          false,
          { signal },
        ),
        staleTime: 60_000,
      });
    } catch {
      return null;
    }
  }, [courseId, queryClient]);

  const openSourceMaterial = useCallback(async (source, options = {}) => {
    if (!source?.id) return;
    if (!isPdfMaterialSource(source)) {
      triggerToast?.('Chỉ học liệu PDF có thể mở bằng thao tác này.');
      return;
    }
    try {
      triggerToast?.('Đang mở PDF giáo trình...');
      const blob = await materialsApi.downloadMaterialPdf(courseId, source.id);
      const url = window.URL.createObjectURL(blob);
      const pageStart = Number(options.pageStart);
      const hash = Number.isFinite(pageStart) && pageStart > 0 ? `#page=${Math.floor(pageStart)}` : '';
      const opened = window.open(`${url}${hash}`, '_blank', 'noopener,noreferrer');
      if (!opened) triggerToast?.('Trình duyệt chặn cửa sổ mới. Cho phép popup rồi thử lại.');
      window.setTimeout(() => window.URL.revokeObjectURL(url), 120000);
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể mở tài liệu nguồn.'));
    }
  }, [courseId, triggerToast]);

  const openEvaluationDetail = useCallback(async (runId) => {
    if (!runId) return null;
    setEvaluationRunId(runId);
    try {
      return await queryClient.fetchQuery({
        queryKey: queryKeys.expertEvaluationDetail(runId),
        queryFn: ({ signal }) => expertTrainingApi.getEvaluationRun(runId, { signal }),
        staleTime: 60_000,
      });
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể tải chi tiết Evaluation.'));
      return null;
    }
  }, [queryClient, triggerToast]);

  return {
    userId,
    reviewerRole,
    canReview,
    courses,
    resources,
    loading,
    errors,
    selectedTask,
    selectedTaskContribution,
    selectedTaskContributions,
    selectedTaskRejection,
    chapterPreview: chapterPreviewQuery.data || null,
    setChapterPreview,
    taskMaterialPreview: taskMaterialQuery.data || null,
    evaluationDetail: evaluationDetailQuery.data || null,
    setEvaluationDetail: (value) => {
      if (!value) setEvaluationRunId('');
    },
    evaluationDetailLoading: Boolean(evaluationRunId)
      && (evaluationDetailQuery.isPending || evaluationDetailQuery.isFetching),
    connectionState,
    pendingReviewCount,
    loadCourses,
    loadChapters,
    refreshChapters,
    loadTasks,
    loadContributions,
    loadGaps,
    loadEvaluation,
    refreshAll,
    refreshLive,
    openChapterPreview,
    loadTaskMaterialPreview,
    openSourceMaterial,
    openEvaluationDetail,
  };
}

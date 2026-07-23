import { useCallback, useEffect, useMemo, useState } from 'react';
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

const createEmptyResources = () => ({
  chapters: [],
  gaps: [],
  tasks: [],
  goldQa: [],
  rubrics: [],
  evalRuns: [],
});

const INITIAL_LOADING = {
  courses: false,
  chapters: false,
  chapterPreview: false,
  taskMaterial: false,
  gaps: false,
  tasks: false,
  contributions: false,
  evaluation: false,
};

export function useExpertTrainingResources({
  currentUser,
  courseId,
  selectedTaskId = '',
  setCourseId,
  triggerToast,
  mode = 'auto',
  mutationActive = false,
}) {
  const userId = currentUser?.userId || currentUser?.id || '';
  const reviewerRole = getTutorV2Role(currentUser);
  const canReview = isTutorV2Reviewer(currentUser);
  const resourceMode = mode === 'auto' ? (canReview ? 'reviewer' : 'teacher') : mode;
  const [courses, setCourses] = useState([]);
  const [resources, setResources] = useState(createEmptyResources);
  const [loading, setLoading] = useState(INITIAL_LOADING);
  const [errors, setErrors] = useState({});
  const [chapterPreview, setChapterPreview] = useState(null);
  const [taskMaterialPreview, setTaskMaterialPreview] = useState(null);
  const [evaluationDetail, setEvaluationDetail] = useState(null);
  const [evaluationDetailLoading, setEvaluationDetailLoading] = useState(false);

  const updateResource = useCallback((key, value) => {
    setResources((current) => ({ ...current, [key]: value }));
  }, []);

  const loadWithState = useCallback(async (key, loader, onSuccess) => {
    setLoading((current) => ({ ...current, [key]: true }));
    setErrors((current) => ({ ...current, [key]: '' }));
    try {
      const result = await loader();
      onSuccess(result);
      return result;
    } catch (error) {
      const message = getUserFacingError(error, 'Không thể tải dữ liệu Tutor V2.');
      setErrors((current) => ({ ...current, [key]: message }));
      return null;
    } finally {
      setLoading((current) => ({ ...current, [key]: false }));
    }
  }, []);

  const loadCourses = useCallback(() => loadWithState(
    'courses',
    () => resourceMode === 'teacher'
      ? teacherApi.getCourses(userId)
      : adminAcademicApi.getCourses(),
    (items) => {
      const normalized = asArray(items, 'courses', 'content')
        .map(normalizeCourseOption)
        .filter((item) => item.id);
      setCourses(normalized);
      if (normalized.length && !normalized.some((item) => item.id === courseId)) {
        setCourseId(normalized[0].id);
      }
    },
  ), [courseId, loadWithState, resourceMode, setCourseId, userId]);

  const loadGaps = useCallback(() => {
    if (!courseId) return Promise.resolve([]);
    return loadWithState('gaps', () => expertTrainingApi.getCoverageGaps(courseId), (items) => {
      updateResource('gaps', items);
    });
  }, [courseId, loadWithState, updateResource]);

  const loadChapters = useCallback(() => {
    if (!courseId) return Promise.resolve([]);
    return loadWithState('chapters', () => expertTrainingApi.getSuggestedChapters(courseId), (items) => {
      updateResource('chapters', items);
    });
  }, [courseId, loadWithState, updateResource]);

  const loadTasks = useCallback(() => {
    if (!courseId) return Promise.resolve([]);
    return loadWithState('tasks', () => expertTrainingApi.getTasks({ courseId }), (items) => {
      updateResource('tasks', items);
    });
  }, [courseId, loadWithState, updateResource]);

  const loadContributions = useCallback(() => {
    if (!courseId) return Promise.resolve([]);
    return loadWithState('contributions', async () => {
      const [goldQa, rubrics] = await Promise.all([
        expertTrainingApi.getGoldQa(courseId),
        expertTrainingApi.getRubrics(courseId),
      ]);
      return { goldQa, rubrics };
    }, ({ goldQa, rubrics }) => {
      setResources((current) => ({ ...current, goldQa, rubrics }));
    });
  }, [courseId, loadWithState]);

  const loadEvaluation = useCallback(() => {
    if (!courseId) return Promise.resolve([]);
    return loadWithState('evaluation', () => expertTrainingApi.getEvaluationRuns(courseId), (items) => {
      updateResource('evalRuns', items);
    });
  }, [courseId, loadWithState, updateResource]);

  const refreshAll = useCallback(async () => {
    if (!courseId) return;
    const loaders = resourceMode === 'teacher'
      ? [loadTasks(), loadContributions()]
      : [loadChapters(), loadGaps(), loadTasks(), loadContributions(), loadEvaluation()];
    await Promise.allSettled(loaders);
  }, [courseId, loadChapters, loadContributions, loadEvaluation, loadGaps, loadTasks, resourceMode]);

  useEffect(() => {
    const timer = window.setTimeout(loadCourses, 0);
    return () => window.clearTimeout(timer);
  }, [loadCourses]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!courseId) {
        setResources(createEmptyResources());
        return;
      }
      setChapterPreview(null);
      setTaskMaterialPreview(null);
      setEvaluationDetail(null);
      refreshAll();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [courseId, refreshAll]);

  const connectionState = useExpertTrainingRealtimeRefresh({
    courseId,
    resourceMode,
    mutationActive,
    refreshAll,
    loadChapters,
    loadContributions,
    loadEvaluation,
    loadGaps,
    loadTasks,
  });

  const selectedTask = useMemo(
    () => resources.tasks.find((task) => task.id === selectedTaskId) || null,
    [resources.tasks, selectedTaskId],
  );

  const selectedTaskRejection = useMemo(() => {
    if (!selectedTask) return null;
    return [...resources.goldQa, ...resources.rubrics]
      .filter((item) => item.sourceTaskId === selectedTask.id && item.status === 'REJECTED')
      .sort((left, right) => (
        new Date(right.updatedAt || right.reviewedAt || 0)
        - new Date(left.updatedAt || left.reviewedAt || 0)
      ))[0] || null;
  }, [resources.goldQa, resources.rubrics, selectedTask]);

  const pendingReviewCount = useMemo(() => (
    resources.goldQa.filter((item) => item.status === 'PENDING_REVIEW').length
    + resources.rubrics.filter((item) => item.status === 'PENDING_REVIEW').length
  ), [resources.goldQa, resources.rubrics]);

  const openChapterPreview = useCallback(async (chapter, expanded = true) => {
    const chapterKey = chapter?.chapterKey || chapter?.id || '';
    const title = chapter?.title || chapter?.chapter || '';
    if (!courseId || (!chapterKey && !title)) return null;
    setLoading((current) => ({ ...current, chapterPreview: true }));
    setErrors((current) => ({ ...current, chapterPreview: '' }));
    try {
      const preview = chapterKey
        ? await expertTrainingApi.getChapterPreview(chapterKey, courseId, expanded)
        : await expertTrainingApi.getChapterPreviewByTitle(courseId, title, expanded);
      setChapterPreview(preview);
      return preview;
    } catch (error) {
      setErrors((current) => ({
        ...current,
        chapterPreview: getUserFacingError(error, 'Không thể tải nội dung chương.'),
      }));
      return null;
    } finally {
      setLoading((current) => ({ ...current, chapterPreview: false }));
    }
  }, [courseId]);

  const loadTaskMaterialPreview = useCallback(async (chapter) => {
    if (!courseId || !chapter) {
      setTaskMaterialPreview(null);
      return null;
    }
    setLoading((current) => ({ ...current, taskMaterial: true }));
    setErrors((current) => ({ ...current, taskMaterial: '' }));
    try {
      const preview = await expertTrainingApi.getChapterPreviewByTitle(courseId, chapter, true);
      setTaskMaterialPreview(preview);
      return preview;
    } catch (error) {
      setErrors((current) => ({
        ...current,
        taskMaterial: getUserFacingError(error, 'Không thể tải tài liệu chương.'),
      }));
      setTaskMaterialPreview(null);
      return null;
    } finally {
      setLoading((current) => ({ ...current, taskMaterial: false }));
    }
  }, [courseId]);

  const openSourceMaterial = useCallback(async (source) => {
    if (!source?.id) return;
    if (!isPdfMaterialSource(source)) {
      triggerToast?.('Chỉ học liệu PDF có thể mở bằng thao tác này.');
      return;
    }
    try {
      const blob = await materialsApi.downloadMaterialPdf(courseId, source.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể mở tài liệu nguồn.'));
    }
  }, [courseId, triggerToast]);

  const openEvaluationDetail = useCallback(async (runId) => {
    setEvaluationDetailLoading(true);
    try {
      const detail = await expertTrainingApi.getEvaluationRun(runId);
      setEvaluationDetail(detail);
      return detail;
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể tải chi tiết Evaluation.'));
      return null;
    } finally {
      setEvaluationDetailLoading(false);
    }
  }, [triggerToast]);

  return {
    userId,
    reviewerRole,
    canReview,
    courses,
    resources,
    loading,
    errors,
    selectedTask,
    selectedTaskRejection,
    chapterPreview,
    setChapterPreview,
    taskMaterialPreview,
    evaluationDetail,
    setEvaluationDetail,
    evaluationDetailLoading,
    connectionState,
    pendingReviewCount,
    loadCourses,
    loadGaps,
    loadChapters,
    loadTasks,
    loadContributions,
    loadEvaluation,
    refreshAll,
    openChapterPreview,
    loadTaskMaterialPreview,
    openSourceMaterial,
    openEvaluationDetail,
  };
}

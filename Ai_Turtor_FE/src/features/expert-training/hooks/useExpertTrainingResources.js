import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const courseIdRef = useRef(courseId);
  courseIdRef.current = courseId;
  const [courses, setCourses] = useState([]);
  const [resources, setResources] = useState(createEmptyResources);
  const [loading, setLoading] = useState(INITIAL_LOADING);
  const [errors, setErrors] = useState({});
  const [chapterPreview, setChapterPreview] = useState(null);
  const [taskMaterialPreview, setTaskMaterialPreview] = useState(null);
  const [evaluationDetail, setEvaluationDetail] = useState(null);
  const [evaluationDetailLoading, setEvaluationDetailLoading] = useState(false);

  const inflightRef = useRef({});
  const updateResource = useCallback((key, value) => {
    setResources((current) => ({ ...current, [key]: value }));
  }, []);

  const loadWithState = useCallback((key, loader, onSuccess) => {
    if (inflightRef.current[key]) return inflightRef.current[key];
    setLoading((current) => ({ ...current, [key]: true }));
    setErrors((current) => ({ ...current, [key]: '' }));
    const run = Promise.resolve()
      .then(loader)
      .then((result) => {
        onSuccess(result);
        return result;
      })
      .catch((error) => {
        const message = getUserFacingError(error, 'Không thể tải dữ liệu Tutor V2.');
        setErrors((current) => ({ ...current, [key]: message }));
        return null;
      })
      .finally(() => {
        setLoading((current) => ({ ...current, [key]: false }));
        if (inflightRef.current[key] === run) inflightRef.current[key] = null;
      });
    inflightRef.current[key] = run;
    return run;
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
      if (normalized.length && !normalized.some((item) => item.id === courseIdRef.current)) {
        setCourseId(normalized[0].id);
      }
    },
  ), [loadWithState, resourceMode, setCourseId, userId]);

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
        resourceMode === 'reviewer'
          ? Promise.resolve([])
          : expertTrainingApi.getRubrics(courseId),
      ]);
      return { goldQa, rubrics };
    }, ({ goldQa, rubrics }) => {
      setResources((current) => ({ ...current, goldQa, rubrics }));
    });
  }, [courseId, loadWithState, resourceMode]);

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
      : [loadChapters(), loadTasks(), loadContributions()];
    await Promise.allSettled(loaders);
  }, [courseId, loadChapters, loadContributions, loadTasks, resourceMode]);

  const refreshLive = useCallback(async () => {
    if (!courseId) return;
    await Promise.allSettled([loadTasks(), loadContributions()]);
  }, [courseId, loadContributions, loadTasks]);

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
    refreshLive,
    loadChapters,
    loadContributions,
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

  const openChapterPreview = useCallback(async (chapter, expanded = false) => {
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
      const preview = await expertTrainingApi.getChapterPreviewByTitle(courseId, chapter, false);
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
      if (!opened) {
        triggerToast?.('Trình duyệt chặn cửa sổ mới. Cho phép popup rồi thử lại.');
      }
      window.setTimeout(() => window.URL.revokeObjectURL(url), 120000);
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
    loadChapters,
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminAcademicApi } from '../../services/adminAcademicApi';
import { expertTrainingApi } from '../../services/expertTrainingApi';
import { materialsApi } from '../../services/materialsApi';
import { normalizeCourseOption } from '../../services/expertTrainingNormalizers';
import { getUserFacingError } from '../../services/httpClient';
import { useRealtimeConnectionState, useRealtimeEvent } from '../realtime/realtimeContext';
import { eventMatchesCourse, REALTIME_EVENT_TYPES } from '../realtime/realtimeEvents';
import { getTutorV2Role, isPdfMaterialSource, isTutorV2Reviewer } from './expertTrainingUtils';
import { expertTrainingGateway } from '../ai-harness/expertTrainingGateway';

const EMPTY_RESOURCES = {
  chapters: [],
  gaps: [],
  tasks: [],
  goldQa: [],
  rubrics: [],
  evalRuns: [],
};

const EMPTY_LOADING = {
  courses: false,
  chapters: false,
  chapterPreview: false,
  taskMaterial: false,
  gaps: false,
  tasks: false,
  contributions: false,
  evaluation: false,
};

export function useExpertTrainingController({
  currentUser,
  courseId,
  selectedTaskId = '',
  setCourseId,
  triggerToast,
}) {
  const userId = currentUser?.userId || currentUser?.id || '';
  const reviewerRole = getTutorV2Role(currentUser);
  const canReview = isTutorV2Reviewer(currentUser);
  const [courses, setCourses] = useState([]);
  const [resources, setResources] = useState(EMPTY_RESOURCES);
  const [loading, setLoading] = useState(EMPTY_LOADING);
  const [errors, setErrors] = useState({});
  const [pendingAction, setPendingAction] = useState('');
  const [chapterPreview, setChapterPreview] = useState(null);
  const [taskMaterialPreview, setTaskMaterialPreview] = useState(null);
  const [evaluationDetail, setEvaluationDetail] = useState(null);
  const [evaluationDetailLoading, setEvaluationDetailLoading] = useState(false);
  const connectionState = useRealtimeConnectionState();
  const realtimeTimerRef = useRef(null);
  const materialTimerRef = useRef(null);
  const hasConnectedRef = useRef(false);
  const pendingActionRef = useRef('');

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
    () => adminAcademicApi.getCourses(),
    (items) => {
      const normalized = items.map(normalizeCourseOption).filter((item) => item.id);
      setCourses(normalized);
      if (!courseId && normalized.length) setCourseId(normalized[0].id);
    },
  ), [courseId, loadWithState, setCourseId]);

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

  const selectedTask = useMemo(
    () => resources.tasks.find((task) => task.id === selectedTaskId) || null,
    [resources.tasks, selectedTaskId],
  );

  const selectedTaskRejection = useMemo(() => {
    if (!selectedTask) return null;
    return [...resources.goldQa, ...resources.rubrics]
      .filter((item) => item.sourceTaskId === selectedTask.id && item.status === 'REJECTED')
      .sort((left, right) => new Date(right.updatedAt || right.reviewedAt || 0) - new Date(left.updatedAt || left.reviewedAt || 0))[0] || null;
  }, [resources.goldQa, resources.rubrics, selectedTask]);

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
    await Promise.allSettled([loadChapters(), loadGaps(), loadTasks(), loadContributions(), loadEvaluation()]);
  }, [courseId, loadChapters, loadContributions, loadEvaluation, loadGaps, loadTasks]);

  useEffect(() => {
    const timer = window.setTimeout(loadCourses, 0);
    return () => window.clearTimeout(timer);
  }, [loadCourses]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!courseId) {
        setResources(EMPTY_RESOURCES);
        return;
      }
      setChapterPreview(null);
      setTaskMaterialPreview(null);
      setEvaluationDetail(null);
      refreshAll();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [courseId, refreshAll]);

  useEffect(() => {
    if (connectionState !== 'CONNECTED') return;
    if (!hasConnectedRef.current) {
      hasConnectedRef.current = true;
      return;
    }
    refreshAll();
  }, [connectionState, refreshAll]);

  const scheduleRealtimeRefresh = useCallback((event) => {
    if (!eventMatchesCourse(event, courseId)) return;
    window.clearTimeout(realtimeTimerRef.current);
    realtimeTimerRef.current = window.setTimeout(() => {
      if (REALTIME_EVENT_TYPES.expertTasks.includes(event.type)) loadTasks();
      if (REALTIME_EVENT_TYPES.expertContributions.includes(event.type)) {
        loadTasks();
        loadContributions();
      }
      if (REALTIME_EVENT_TYPES.expertEvaluation.includes(event.type)) loadEvaluation();
    }, 350);
  }, [courseId, loadContributions, loadEvaluation, loadTasks]);

  useRealtimeEvent(REALTIME_EVENT_TYPES.tutorV2, scheduleRealtimeRefresh);

  const scheduleMaterialRefresh = useCallback((event) => {
    if (!eventMatchesCourse(event, courseId)) return;
    window.clearTimeout(materialTimerRef.current);
    materialTimerRef.current = window.setTimeout(() => {
      loadChapters();
      loadGaps();
    }, 350);
  }, [courseId, loadChapters, loadGaps]);

  useRealtimeEvent(REALTIME_EVENT_TYPES.material, scheduleMaterialRefresh);

  useEffect(() => () => {
    window.clearTimeout(realtimeTimerRef.current);
    window.clearTimeout(materialTimerRef.current);
  }, []);

  const runMutation = useCallback(async ({ key, action, successMessage, refresh }) => {
    if (pendingActionRef.current) return null;
    pendingActionRef.current = key;
    setPendingAction(key);
    try {
      const result = await action();
      triggerToast?.(successMessage);
      await refresh?.();
      return result;
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể hoàn tất thao tác.'));
      return null;
    } finally {
      pendingActionRef.current = '';
      setPendingAction('');
    }
  }, [triggerToast]);

  const analyzeCoverage = useCallback((payload) => runMutation({
    key: 'analyze-coverage',
    action: () => expertTrainingGateway.analyzeCoverage({
      ...payload,
      courseId,
      requestedBy: userId,
    }),
    successMessage: 'Đã hoàn tất phân tích độ phủ.',
    refresh: () => Promise.allSettled([loadGaps(), loadTasks()]),
  }), [courseId, loadGaps, loadTasks, runMutation, userId]);

  const confirmChapterSelection = useCallback((chapterKeys) => runMutation({
    key: 'confirm-chapters',
    action: () => expertTrainingApi.confirmChapters({
      courseId,
      confirmedBy: userId,
      chapterKeys,
    }),
    successMessage: 'Đã xác nhận danh sách chương dùng cho Coverage.',
    refresh: () => Promise.allSettled([loadChapters(), loadGaps()]),
  }), [courseId, loadChapters, loadGaps, runMutation, userId]);

  const addManualChapter = useCallback((title) => runMutation({
    key: 'add-manual-chapter',
    action: () => expertTrainingApi.addManualChapter({
      courseId,
      title,
      createdBy: userId,
      confirmImmediately: true,
    }),
    successMessage: 'Đã thêm và xác nhận chương thủ công.',
    refresh: loadChapters,
  }), [courseId, loadChapters, runMutation, userId]);

  const createTasksForChapter = useCallback((chapter, options) => runMutation({
    key: `create-chapter-tasks:${chapter}`,
    action: () => expertTrainingApi.createChapterTasks({
      courseId,
      chapter,
      createdBy: userId,
      includeTrainingGoldTask: Boolean(options?.includeTrainingGoldTask),
      includeEvaluationGoldTask: Boolean(options?.includeEvaluationGoldTask),
    }),
    successMessage: 'Đã tạo task mở cho chương đã chọn.',
    refresh: () => Promise.allSettled([loadTasks(), loadGaps(), loadChapters()]),
  }), [courseId, loadChapters, loadGaps, loadTasks, runMutation, userId]);

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
      const message = getUserFacingError(error, 'Không thể tải nội dung chương.');
      setErrors((current) => ({ ...current, chapterPreview: message }));
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
      const message = getUserFacingError(error, 'Không thể tải tài liệu chương.');
      setErrors((current) => ({ ...current, taskMaterial: message }));
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

  const createTask = useCallback((payload) => runMutation({
    key: 'create-task',
    action: () => expertTrainingApi.createTask({
      ...payload,
      courseId,
      createdBy: userId,
    }),
    successMessage: 'Đã tạo công việc chuyên gia.',
    refresh: loadTasks,
  }), [courseId, loadTasks, runMutation, userId]);

  const claimTask = useCallback((task) => runMutation({
    key: `claim-task:${task.id}`,
    action: () => expertTrainingApi.assignTask(task.id, {
      assigneeId: userId,
      assigneeTier: reviewerRole,
    }),
    successMessage: 'Bạn đã nhận công việc.',
    refresh: loadTasks,
  }), [loadTasks, reviewerRole, runMutation, userId]);

  const submitGoldQa = useCallback((payload) => runMutation({
    key: 'submit-gold-qa',
    action: () => expertTrainingGateway.submitGoldQa({
      ...payload,
      courseId,
      authorId: userId,
    }),
    successMessage: 'Đã gửi Gold Q&A để Senior Mentor kiểm duyệt.',
    refresh: () => Promise.allSettled([loadTasks(), loadContributions()]),
  }), [courseId, loadContributions, loadTasks, runMutation, userId]);

  const submitRubric = useCallback((payload) => runMutation({
    key: 'submit-rubric',
    action: () => expertTrainingGateway.submitRubric({
      ...payload,
      courseId,
      authorId: userId,
    }),
    successMessage: 'Đã gửi Rubric để Senior Mentor kiểm duyệt.',
    refresh: () => Promise.allSettled([loadTasks(), loadContributions()]),
  }), [courseId, loadContributions, loadTasks, runMutation, userId]);

  const reviewGoldQa = useCallback((item, decision, values) => runMutation({
    key: `review-gold:${item.id}`,
    action: () => expertTrainingGateway.reviewGoldQa(item.id, decision, {
      reviewerId: userId,
      reviewerRole,
      reviewNote: values.reviewNote || '',
      rejectionReason: decision === 'reject' ? values.rejectionReason : undefined,
    }),
    successMessage: decision === 'approve'
      ? item.usage === 'TRAINING'
        ? 'Gold Q&A đã được duyệt và đưa vào tri thức môn học.'
        : 'Evaluation holdout đã được duyệt và không được index.'
      : 'Gold Q&A cần được chỉnh sửa trước khi duyệt.',
    refresh: () => Promise.allSettled([loadTasks(), loadContributions(), loadGaps()]),
  }), [loadContributions, loadGaps, loadTasks, reviewerRole, runMutation, userId]);

  const reviewRubric = useCallback((item, decision, values) => runMutation({
    key: `review-rubric:${item.id}`,
    action: () => expertTrainingGateway.reviewRubric(item.id, decision, {
      reviewerId: userId,
      reviewerRole,
      reviewNote: values.reviewNote || '',
      rejectionReason: decision === 'reject' ? values.rejectionReason : undefined,
    }),
    successMessage: decision === 'approve' ? 'Rubric đã được phê duyệt.' : 'Rubric cần được chỉnh sửa trước khi duyệt.',
    refresh: () => Promise.allSettled([loadTasks(), loadContributions()]),
  }), [loadContributions, loadTasks, reviewerRole, runMutation, userId]);

  const startEvaluation = useCallback((payload) => runMutation({
    key: 'start-evaluation',
    action: () => expertTrainingGateway.startEvaluation({
      ...payload,
      courseId,
      triggeredBy: userId,
    }),
    successMessage: 'Evaluation đã hoàn tất và kết quả canonical đã được tải lại.',
    refresh: loadEvaluation,
  }), [courseId, loadEvaluation, runMutation, userId]);

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

  const pendingReviewCount = useMemo(() => (
    resources.goldQa.filter((item) => item.status === 'PENDING_REVIEW').length
    + resources.rubrics.filter((item) => item.status === 'PENDING_REVIEW').length
  ), [resources.goldQa, resources.rubrics]);

  return {
    userId,
    reviewerRole,
    canReview,
    courses,
    courseId,
    setCourseId,
    resources,
    loading,
    errors,
    pendingAction,
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
    analyzeCoverage,
    confirmChapterSelection,
    addManualChapter,
    createTasksForChapter,
    openChapterPreview,
    loadTaskMaterialPreview,
    openSourceMaterial,
    createTask,
    claimTask,
    submitGoldQa,
    submitRubric,
    reviewGoldQa,
    reviewRubric,
    startEvaluation,
    openEvaluationDetail,
  };
}

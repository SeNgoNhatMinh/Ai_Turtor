import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminAcademicApi } from '../../services/adminAcademicApi';
import { expertTrainingApi } from '../../services/expertTrainingApi';
import { normalizeCourseOption } from '../../services/expertTrainingNormalizers';
import { getUserFacingError } from '../../services/httpClient';
import { useRealtimeConnectionState, useRealtimeEvent } from '../realtime/realtimeContext';
import { eventMatchesCourse, REALTIME_EVENT_TYPES } from '../realtime/realtimeEvents';
import { getTutorV2Role, isTutorV2Reviewer } from './expertTrainingUtils';
import { expertTrainingGateway } from '../ai-harness/expertTrainingGateway';

const EMPTY_RESOURCES = {
  gaps: [],
  tasks: [],
  goldQa: [],
  rubrics: [],
  evalRuns: [],
};

const EMPTY_LOADING = {
  courses: false,
  gaps: false,
  tasks: false,
  contributions: false,
  evaluation: false,
};

export function useExpertTrainingController({
  currentUser,
  courseId,
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
  const [selectedTask, setSelectedTask] = useState(null);
  const [evaluationDetail, setEvaluationDetail] = useState(null);
  const [evaluationDetailLoading, setEvaluationDetailLoading] = useState(false);
  const connectionState = useRealtimeConnectionState();
  const realtimeTimerRef = useRef(null);
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
      const message = getUserFacingError(error, 'Unable to load Tutor V2 data.');
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

  const loadTasks = useCallback(() => {
    if (!courseId) return Promise.resolve([]);
    return loadWithState('tasks', () => expertTrainingApi.getTasks({ courseId }), (items) => {
      updateResource('tasks', items);
      setSelectedTask((current) => current
        ? items.find((item) => item.id === current.id) || current
        : current);
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
    await Promise.allSettled([loadGaps(), loadTasks(), loadContributions(), loadEvaluation()]);
  }, [courseId, loadContributions, loadEvaluation, loadGaps, loadTasks]);

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
      setSelectedTask(null);
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

  useEffect(() => () => window.clearTimeout(realtimeTimerRef.current), []);

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
      triggerToast?.(getUserFacingError(error, 'The action could not be completed.'));
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
    successMessage: 'Coverage analysis completed.',
    refresh: () => Promise.allSettled([loadGaps(), loadTasks()]),
  }), [courseId, loadGaps, loadTasks, runMutation, userId]);

  const createTask = useCallback((payload) => runMutation({
    key: 'create-task',
    action: () => expertTrainingApi.createTask({
      ...payload,
      courseId,
      createdBy: userId,
    }),
    successMessage: 'Expert task created.',
    refresh: loadTasks,
  }), [courseId, loadTasks, runMutation, userId]);

  const claimTask = useCallback((task) => runMutation({
    key: `claim-task:${task.id}`,
    action: () => expertTrainingApi.assignTask(task.id, {
      assigneeId: userId,
      assigneeTier: reviewerRole,
    }),
    successMessage: 'Task assigned to you.',
    refresh: loadTasks,
  }), [loadTasks, reviewerRole, runMutation, userId]);

  const submitGoldQa = useCallback((payload) => runMutation({
    key: 'submit-gold-qa',
    action: () => expertTrainingGateway.submitGoldQa({
      ...payload,
      courseId,
      authorId: userId,
    }),
    successMessage: 'Gold Q&A submitted for senior review.',
    refresh: () => Promise.allSettled([loadTasks(), loadContributions()]),
  }), [courseId, loadContributions, loadTasks, runMutation, userId]);

  const submitRubric = useCallback((payload) => runMutation({
    key: 'submit-rubric',
    action: () => expertTrainingGateway.submitRubric({
      ...payload,
      courseId,
      authorId: userId,
    }),
    successMessage: 'Rubric submitted for senior review.',
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
        ? 'Gold Q&A approved and indexed into course knowledge.'
        : 'Evaluation holdout approved without indexing.'
      : 'Gold Q&A rejected and returned for correction.',
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
    successMessage: decision === 'approve' ? 'Rubric approved.' : 'Rubric rejected and returned for correction.',
    refresh: () => Promise.allSettled([loadTasks(), loadContributions()]),
  }), [loadContributions, loadTasks, reviewerRole, runMutation, userId]);

  const startEvaluation = useCallback((payload) => runMutation({
    key: 'start-evaluation',
    action: () => expertTrainingGateway.startEvaluation({
      ...payload,
      courseId,
      triggeredBy: userId,
    }),
    successMessage: 'Evaluation completed. Canonical results were reloaded.',
    refresh: loadEvaluation,
  }), [courseId, loadEvaluation, runMutation, userId]);

  const openEvaluationDetail = useCallback(async (runId) => {
    setEvaluationDetailLoading(true);
    try {
      const detail = await expertTrainingApi.getEvaluationRun(runId);
      setEvaluationDetail(detail);
      return detail;
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Unable to load evaluation details.'));
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
    setSelectedTask,
    evaluationDetail,
    setEvaluationDetail,
    evaluationDetailLoading,
    connectionState,
    pendingReviewCount,
    loadCourses,
    loadGaps,
    loadTasks,
    loadContributions,
    loadEvaluation,
    refreshAll,
    analyzeCoverage,
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

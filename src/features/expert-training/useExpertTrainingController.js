import { useCallback, useRef, useState } from 'react';
import { expertTrainingApi } from '../../services/expertTrainingApi';
import { getUserFacingError } from '../../services/httpClient';
import { expertTrainingGateway } from '../ai-harness/expertTrainingGateway';
import { useExpertTrainingResources } from './hooks/useExpertTrainingResources';

export function useExpertTrainingController({
  currentUser,
  courseId,
  selectedTaskId = '',
  setCourseId,
  triggerToast,
  mode = 'auto',
}) {
  const [pendingAction, setPendingAction] = useState('');
  const pendingActionRef = useRef('');
  const resourceState = useExpertTrainingResources({
    currentUser,
    courseId,
    selectedTaskId,
    setCourseId,
    triggerToast,
    mode,
    mutationActive: Boolean(pendingAction),
  });
  const {
    userId,
    reviewerRole,
    loadChapters,
    loadContributions,
    loadEvaluation,
    loadGaps,
    loadTasks,
  } = resourceState;

  const runMutation = useCallback(async ({
    key,
    action,
    successMessage,
    refresh,
  }) => {
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

  const claimTask = useCallback((task) => {
    if (reviewerRole !== 'TEACHER') {
      triggerToast?.('Chỉ giảng viên được nhận task đóng góp.');
      return Promise.resolve(null);
    }
    return runMutation({
      key: `claim-task:${task.id}`,
      action: () => expertTrainingApi.assignTask(task.id, {
        assigneeId: userId,
        assigneeTier: 'TEACHER',
      }),
      successMessage: 'Đã nhận task.',
      refresh: loadTasks,
    });
  }, [loadTasks, reviewerRole, runMutation, triggerToast, userId]);

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
    successMessage: decision === 'approve'
      ? 'Rubric đã được phê duyệt.'
      : 'Rubric cần được chỉnh sửa trước khi duyệt.',
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

  return {
    ...resourceState,
    courseId,
    setCourseId,
    pendingAction,
    analyzeCoverage,
    confirmChapterSelection,
    addManualChapter,
    createTasksForChapter,
    claimTask,
    submitGoldQa,
    submitRubric,
    reviewGoldQa,
    reviewRubric,
    startEvaluation,
  };
}

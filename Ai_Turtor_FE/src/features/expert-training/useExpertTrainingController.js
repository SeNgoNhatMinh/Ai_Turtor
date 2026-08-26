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
      if (typeof successMessage === 'function') {
        const message = successMessage(result);
        if (message) triggerToast?.(message);
      } else if (successMessage) {
        triggerToast?.(successMessage);
      }
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
    key: `start-chapter:${chapter}`,
    action: () => expertTrainingApi.startChapter({
      courseId,
      chapter,
      createdBy: userId,
      questionCount: options?.questionCount || 2,
      dueAt: options?.dueAt,
    }),
    successMessage: 'Đã bắt đầu chương. Giảng viên có thể nhận việc Q&A vàng.',
    refresh: () => Promise.allSettled([loadTasks(), loadChapters()]),
  }), [courseId, loadChapters, loadTasks, runMutation, userId]);

  const startChapter = createTasksForChapter;

  const ignoreChapter = useCallback((chapter) => {
    const chapterKey = chapter?.chapterKey || chapter?.id;
    if (!courseId || !chapterKey) return Promise.resolve(null);
    return runMutation({
      key: `ignore-chapter:${chapterKey}`,
      action: () => expertTrainingApi.ignoreChapter(courseId, chapterKey),
      successMessage: 'Đã ẩn mục khỏi danh sách huấn luyện. File PDF vẫn giữ nguyên.',
      refresh: loadChapters,
    });
  }, [courseId, loadChapters, runMutation]);

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

  const submitGoldQa = useCallback((payload, options = {}) => runMutation({
    key: options.exam === true ? 'submit-gold-qa' : 'save-gold-draft',
    action: () => expertTrainingGateway.submitGoldQa({
      ...payload,
      courseId,
      authorId: userId,
    }, { exam: options.exam === true }),
    successMessage: options.exam === true
      ? 'Đã lưu và cho AI thi lần 1 (chưa gắn ý GV).'
      : 'Đã thêm vào danh sách (bản nháp). Chưa cho AI thi.',
    refresh: () => Promise.allSettled([loadTasks(), loadContributions()]),
  }), [courseId, loadContributions, loadTasks, runMutation, userId]);

  const examGoldQa = useCallback((goldQaId) => runMutation({
    key: `exam-gold-qa:${goldQaId}`,
    action: () => expertTrainingGateway.examGoldQa(goldQaId),
    successMessage: (result) => (
      result?.status === 'BASELINE_EXAMINED'
        ? 'AI đã thi lần 1 (chưa gắn ý GV). Còn 1 lượt thi lại để gộp ý GV.'
        : 'AI đã thi lại: gộp lần 1 + ý GV. Đã hết 2 lượt — gửi Senior khi ổn.'
    ),
    refresh: () => Promise.allSettled([loadTasks(), loadContributions()]),
  }), [loadContributions, loadTasks, runMutation]);

  const examAllDraftGoldQa = useCallback(async (goldQaIds = []) => {
    const ids = (goldQaIds || []).filter(Boolean);
    if (!ids.length) {
      triggerToast?.('Không có câu nháp nào cần AI thi.');
      return null;
    }
    let last = null;
    for (const id of ids) {
      last = await runMutation({
        key: `exam-gold-qa:${id}`,
        action: () => expertTrainingGateway.examGoldQa(id),
        successMessage: null,
        refresh: null,
      });
      if (!last) break;
    }
    await Promise.allSettled([loadTasks(), loadContributions()]);
    if (last) {
      triggerToast?.(`Đã cho AI thi lần 1 (${ids.length} câu). Thi lại từng câu để gắn ý GV.`);
    }
    return last;
  }, [loadContributions, loadTasks, runMutation, triggerToast]);

  const deleteGoldQa = useCallback((goldQaId) => runMutation({
    key: `delete-gold-qa:${goldQaId}`,
    action: () => expertTrainingGateway.deleteGoldQa(goldQaId, userId),
    successMessage: 'Đã xóa câu hỏi khỏi danh sách.',
    refresh: () => Promise.allSettled([loadTasks(), loadContributions()]),
  }), [loadContributions, loadTasks, runMutation, userId]);

  const sendGoldQaForReview = useCallback((goldQaId) => runMutation({
    key: `send-gold-qa:${goldQaId}`,
    action: () => expertTrainingGateway.sendGoldQaForReview(goldQaId),
    successMessage: 'Đã gửi Senior. Senior chỉ duyệt nạp RAG; AI chưa phục vụ SV bằng ghi chú này.',
    refresh: () => Promise.allSettled([loadTasks(), loadContributions()]),
  }), [loadContributions, loadTasks, runMutation]);

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
        ? 'Đã nạp ghi chú theo giáo trình vào RAG (sách vẫn là chuẩn).'
        : 'Đã duyệt holdout EVALUATION (không nạp vào RAG).'
      : 'Cần chỉnh tóm tắt cho khớp giáo trình. Lượt thi AI đã reset — Teacher thi lại 2 lần rồi gửi.',
    refresh: () => Promise.allSettled([loadTasks(), loadContributions()]),
  }), [loadContributions, loadTasks, reviewerRole, runMutation, userId]);

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
    startChapter,
    ignoreChapter,
    claimTask,
    submitGoldQa,
    examGoldQa,
    examAllDraftGoldQa,
    deleteGoldQa,
    sendGoldQaForReview,
    submitRubric,
    reviewGoldQa,
    reviewRubric,
    startEvaluation,
  };
}

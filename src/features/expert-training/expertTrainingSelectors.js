const REVIEWABLE_STATUS = 'PENDING_REVIEW';
const ACTIVE_TASK_STATUSES = new Set(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED']);
const FINISHED_TASK_STATUSES = new Set(['COMPLETED', 'DONE']);

const asTime = (value) => {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

const newestFirst = (left, right) => (
  asTime(right.completedAt || right.updatedAt || right.createdAt || right.submittedAt)
  - asTime(left.completedAt || left.updatedAt || left.createdAt || left.submittedAt)
);

export function groupReviewQueue(goldQa = [], rubrics = []) {
  return [
    ...goldQa
      .filter((item) => item.status === REVIEWABLE_STATUS)
      .map((item) => ({ id: item.id, kind: 'GOLD_QA', item })),
    ...rubrics
      .filter((item) => item.status === REVIEWABLE_STATUS)
      .map((item) => ({ id: item.id, kind: 'RUBRIC', item })),
  ].sort((left, right) => newestFirst(left.item, right.item));
}

export function getEvaluationReadiness(resources = {}) {
  const goldQa = resources.goldQa || [];
  const rubrics = resources.rubrics || [];
  const approvedHoldouts = goldQa.filter((item) => (
    item.usage === 'EVALUATION' && item.status === 'APPROVED'
  ));
  const approvedRubrics = rubrics.filter((item) => item.status === 'APPROVED');
  const chapters = [...new Set(approvedHoldouts.map((item) => item.chapter).filter(Boolean))];

  return {
    ready: approvedHoldouts.length > 0,
    holdoutCount: approvedHoldouts.length,
    rubricCount: approvedRubrics.length,
    chapters,
    reason: approvedHoldouts.length
      ? ''
      : 'Cần ít nhất một Evaluation Gold Q&A đã được phê duyệt.',
    warning: approvedHoldouts.length > 0 && !approvedRubrics.length
      ? 'Chưa có Rubric được phê duyệt; Evaluation vẫn có thể chạy nhưng tiêu chí đánh giá sẽ kém rõ ràng hơn.'
      : '',
  };
}

export function buildExpertTrainingSummary(resources = {}) {
  const gaps = resources.gaps || [];
  const tasks = resources.tasks || [];
  const goldQa = resources.goldQa || [];
  const rubrics = resources.rubrics || [];
  const evalRuns = [...(resources.evalRuns || [])].sort(newestFirst);
  const reviewQueue = groupReviewQueue(goldQa, rubrics);

  return {
    gapCount: gaps.filter((item) => ['OPEN', 'TASK_CREATED'].includes(item.status)).length,
    criticalGapCount: gaps.filter((item) => item.severity === 'CRITICAL' && item.status !== 'RESOLVED').length,
    activeTaskCount: tasks.filter((item) => ACTIVE_TASK_STATUSES.has(item.status)).length,
    completedTaskCount: tasks.filter((item) => FINISHED_TASK_STATUSES.has(item.status)).length,
    pendingReviewCount: reviewQueue.length,
    approvedTrainingCount: goldQa.filter((item) => item.usage === 'TRAINING' && item.status === 'INDEXED').length,
    approvedEvaluationCount: goldQa.filter((item) => item.usage === 'EVALUATION' && item.status === 'APPROVED').length,
    latestEvaluation: evalRuns[0] || null,
    reviewQueue,
  };
}

export function getExpertTrainingNextAction(resources = {}, { canReview = false, userId = '' } = {}) {
  const summary = buildExpertTrainingSummary(resources);
  const tasks = resources.tasks || [];
  const goldQa = resources.goldQa || [];
  const rubrics = resources.rubrics || [];

  if (canReview && summary.reviewQueue.length) {
    const review = summary.reviewQueue[0];
    return {
      key: `review:${review.id}`,
      view: 'content',
      reviewId: review.id,
      title: 'Kiểm duyệt nội dung đang chờ',
      description: review.kind === 'GOLD_QA'
        ? `${review.item.chapter} · ${review.item.usage === 'EVALUATION' ? 'Evaluation holdout' : 'Training Gold Q&A'}`
        : `${review.item.chapter} · Rubric`,
      status: REVIEWABLE_STATUS,
    };
  }

  if (!canReview) {
    const assigned = tasks.find((task) => (
      task.assigneeId === userId && ['ASSIGNED', 'IN_PROGRESS'].includes(task.status)
    ));
    if (assigned) {
      return {
        key: `task:${assigned.id}`,
        view: 'work',
        taskId: assigned.id,
        title: 'Tiếp tục công việc được giao',
        description: `${assigned.chapter} · ${assigned.title}`,
        status: assigned.status,
      };
    }

    const rejected = [...goldQa, ...rubrics]
      .filter((item) => item.authorId === userId && item.status === 'REJECTED')
      .sort(newestFirst)[0];
    if (rejected) {
      return {
        key: `revision:${rejected.id}`,
        view: 'content',
        title: 'Xem nội dung cần chỉnh sửa',
        description: `${rejected.chapter} · Senior Mentor đã yêu cầu cập nhật`,
        status: rejected.status,
      };
    }

    const available = tasks.find((task) => task.status === 'OPEN');
    if (available) {
      return {
        key: `task:${available.id}`,
        view: 'work',
        taskId: available.id,
        title: 'Nhận công việc đang mở',
        description: `${available.chapter} · ${available.title}`,
        status: available.status,
      };
    }
  }

  const criticalGap = (resources.gaps || []).find((gap) => (
    gap.status !== 'RESOLVED' && gap.severity === 'CRITICAL'
  ));
  if (canReview && criticalGap) {
    return {
      key: `gap:${criticalGap.id}`,
      view: 'overview',
      title: 'Xử lý chương thiếu độ phủ nghiêm trọng',
      description: criticalGap.chapter,
      status: criticalGap.severity,
    };
  }

  const readiness = getEvaluationReadiness(resources);
  if (canReview && readiness.ready) {
    return {
      key: 'evaluation-ready',
      view: 'evaluation',
      title: 'Chạy Evaluation với bộ holdout đã duyệt',
      description: `${readiness.holdoutCount} câu hỏi trên ${readiness.chapters.length} chương sẵn sàng`,
      status: 'APPROVED',
    };
  }

  return {
    key: 'workflow-clear',
    view: 'overview',
    title: 'Không có việc ưu tiên',
    description: canReview
      ? 'Hàng chờ đã sạch. Có thể phân tích lại độ phủ khi cần.'
      : 'Chưa có công việc mới được giao cho bạn.',
    status: 'COMPLETED',
  };
}

export function buildWorkflowSteps(resources = {}) {
  const summary = buildExpertTrainingSummary(resources);
  const readiness = getEvaluationReadiness(resources);
  const hasContributions = (resources.goldQa || []).length + (resources.rubrics || []).length > 0;
  const hasTasks = (resources.tasks || []).length > 0;
  const hasGaps = (resources.gaps || []).length > 0;
  const hasReviews = summary.pendingReviewCount > 0
    || summary.approvedTrainingCount > 0
    || summary.approvedEvaluationCount > 0;
  const hasEvaluations = (resources.evalRuns || []).length > 0;

  return [
    { key: 'coverage', title: 'Phát hiện thiếu hụt', description: 'Đo độ phủ theo chương', state: hasGaps ? 'complete' : 'active' },
    { key: 'tasks', title: 'Giao việc', description: 'Tạo hoặc nhận task', state: hasTasks ? 'complete' : hasGaps ? 'active' : 'upcoming' },
    { key: 'contribute', title: 'Đóng góp', description: 'Gold Q&A hoặc Rubric', state: hasContributions ? 'complete' : hasTasks ? 'active' : 'upcoming' },
    { key: 'review', title: 'Kiểm duyệt', description: 'Senior/Admin phê duyệt', state: hasReviews ? 'complete' : hasContributions ? 'active' : 'upcoming' },
    { key: 'evaluation', title: 'Evaluation', description: 'Đánh giá Tutor bằng holdout', state: hasEvaluations ? 'complete' : readiness.ready ? 'active' : 'upcoming' },
  ];
}

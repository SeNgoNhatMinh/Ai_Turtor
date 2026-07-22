import { Card } from 'antd';
import { AlertTriangle, CheckCircle2, ClipboardList, Gauge } from 'lucide-react';
import ActionQueue from '../../../components/common/ActionQueue';
import MetricStrip from '../../../components/common/MetricStrip';
import WorkflowStepper from '../../../components/common/WorkflowStepper';
import { formatPercent } from '../expertTrainingUtils';
import {
  buildExpertTrainingSummary,
  buildWorkflowSteps,
  getExpertTrainingNextAction,
} from '../expertTrainingSelectors';
import ChapterCoveragePanel from './ChapterCoveragePanel';
import CoverageDashboard from './CoverageDashboard';

export default function ExpertTrainingOverview({
  resources,
  loading,
  errors,
  canReview,
  userId,
  pendingAction,
  onAnalyzeCoverage,
  onRefreshCoverage,
  chapterPreview,
  onRefreshChapters,
  onConfirmChapters,
  onAddManualChapter,
  onPreviewChapter,
  onCloseChapterPreview,
  onCreateChapterTasks,
  onOpenMaterial,
  onNavigateAction,
  onCreateTaskFromGap,
}) {
  const summary = buildExpertTrainingSummary(resources);
  const nextAction = getExpertTrainingNextAction(resources, { canReview, userId });
  const workflowSteps = buildWorkflowSteps(resources);
  const latestEvaluation = summary.latestEvaluation;
  const metrics = [
    {
      key: 'gaps',
      label: 'Chương đang thiếu độ phủ',
      value: summary.gapCount,
      description: summary.criticalGapCount
        ? `${summary.criticalGapCount} chương ở mức nghiêm trọng`
        : 'Không có chương ở mức nghiêm trọng',
      icon: AlertTriangle,
    },
    {
      key: 'tasks',
      label: 'Công việc đang mở',
      value: summary.activeTaskCount,
      description: `${summary.completedTaskCount} công việc đã hoàn tất`,
      icon: ClipboardList,
    },
    {
      key: 'reviews',
      label: 'Nội dung chờ kiểm duyệt',
      value: summary.pendingReviewCount,
      description: canReview ? 'Cần Senior/Admin quyết định' : 'Đang chờ Senior/Admin xử lý',
      icon: CheckCircle2,
    },
    {
      key: 'evaluation',
      label: 'Evaluation gần nhất',
      value: latestEvaluation ? formatPercent(latestEvaluation.averageScore) : '—',
      description: latestEvaluation
        ? `${latestEvaluation.chapter} · ${latestEvaluation.status === 'PASSED' ? 'Đạt' : 'Chưa đạt'}`
        : 'Chưa có phiên Evaluation',
      icon: Gauge,
    },
  ];

  return (
    <div className="expert-training__overview">
      <MetricStrip items={metrics} ariaLabel="Chỉ số Tutor V2" />

      <Card title="Quy trình nâng chất lượng AI Tutor" className="expert-training__workflow-card">
        <WorkflowStepper steps={workflowSteps} ariaLabel="Quy trình Tutor V2" />
      </Card>

      <Card
        title={canReview ? 'Việc ưu tiên của bạn' : 'Công việc tiếp theo'}
        className="expert-training__attention-card"
      >
        <ActionQueue
          items={[{
            ...nextAction,
            onClick: () => onNavigateAction(nextAction),
          }]}
        />
      </Card>

      <ChapterCoveragePanel
        chapters={resources.chapters}
        loading={loading.chapters}
        error={errors.chapters}
        canReview={canReview}
        pendingAction={pendingAction}
        preview={chapterPreview}
        previewLoading={loading.chapterPreview}
        previewError={errors.chapterPreview}
        onRefresh={onRefreshChapters}
        onConfirm={onConfirmChapters}
        onAddManual={onAddManualChapter}
        onPreview={onPreviewChapter}
        onClosePreview={onCloseChapterPreview}
        onCreateTasks={onCreateChapterTasks}
        onOpenMaterial={onOpenMaterial}
      />

      <CoverageDashboard
        compact
        gaps={resources.gaps}
        chapters={resources.chapters}
        loading={loading.gaps}
        error={errors.gaps}
        canReview={canReview}
        pendingAction={pendingAction}
        onAnalyze={onAnalyzeCoverage}
        onRefresh={onRefreshCoverage}
        onCreateTaskFromGap={onCreateTaskFromGap}
      />
    </div>
  );
}

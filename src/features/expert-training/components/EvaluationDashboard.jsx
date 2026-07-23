import { useEffect, useState } from 'react';
import { Alert, Button, Space, Tooltip } from 'antd';
import { FlaskConical, Gauge, History, Play, RefreshCw, ShieldAlert } from 'lucide-react';
import MetricStrip from '../../../components/common/MetricStrip';
import { formatPercent } from '../expertTrainingUtils';
import EvaluationDetailModal from './evaluation/EvaluationDetailModal';
import EvaluationProgress from './evaluation/EvaluationProgress';
import EvaluationRunsTable from './evaluation/EvaluationRunsTable';
import EvaluationStartModal from './evaluation/EvaluationStartModal';

export default function EvaluationDashboard({
  runs = [],
  readiness = {},
  canReview,
  loading,
  error,
  pendingAction,
  detail,
  detailLoading,
  onRefresh,
  onStart,
  onOpenDetail,
  onCloseDetail,
}) {
  const [startOpen, setStartOpen] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [progressCollapsed, setProgressCollapsed] = useState(false);
  const passedRuns = runs.filter((run) => run.status === 'PASSED').length;
  const regressionRuns = runs.filter((run) => run.regressionDetected).length;
  const latestRun = runs[0];
  const canStart = canReview && readiness.ready && !pendingAction;

  useEffect(() => {
    if (!runStartedAt) return undefined;
    const intervalId = window.setInterval(() => {
      setElapsedMs(Date.now() - runStartedAt);
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [runStartedAt]);

  const startEvaluation = async (values) => {
    if (!readiness.ready) return null;
    setStartOpen(false);
    setProgressCollapsed(false);
    setElapsedMs(0);
    setRunStartedAt(Date.now());
    try {
      return await onStart({
        chapter: values.chapter?.trim() || null,
        harnessVersion: values.harnessVersion?.trim() || 'v2-mvp-deterministic',
        kbVersion: values.kbVersion?.trim() || 'current',
        promptVersion: values.promptVersion?.trim() || 'current',
        passThreshold: values.passThreshold,
      });
    } finally {
      setRunStartedAt(0);
      setElapsedMs(0);
      setProgressCollapsed(false);
    }
  };

  const metrics = [
    {
      key: 'runs',
      label: 'Số lần Evaluation',
      value: runs.length,
      description: 'Dữ liệu canonical từ backend',
      icon: History,
    },
    {
      key: 'passed',
      label: 'Phiên đạt',
      value: passedRuns,
      description: `${runs.length - passedRuns} phiên chưa đạt hoặc đang xử lý`,
      icon: FlaskConical,
    },
    {
      key: 'regressions',
      label: 'Regression phát hiện',
      value: regressionRuns,
      description: 'So với phiên đạt gần nhất',
      icon: ShieldAlert,
    },
    {
      key: 'latest',
      label: 'Điểm gần nhất',
      value: latestRun ? formatPercent(latestRun.averageScore) : '—',
      description: latestRun?.chapter || 'Chưa có kết quả',
      icon: Gauge,
    },
  ];

  return (
    <section className="expert-training__section" aria-labelledby="evaluation-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="evaluation-heading">Evaluation độc lập</h2>
          <p>Đánh giá AI Tutor bằng bộ holdout đã duyệt; câu trả lời Evaluation không được index vào RAG.</p>
        </div>
        <Space wrap>
          <Button icon={<RefreshCw size={16} />} onClick={onRefresh} loading={loading}>Làm mới</Button>
          {canReview && (
            <Tooltip title={readiness.ready ? '' : readiness.reason}>
              <span>
                <Button
                  type="primary"
                  icon={<Play size={16} />}
                  onClick={() => setStartOpen(true)}
                  disabled={!canStart}
                >
                  Chạy Evaluation
                </Button>
              </span>
            </Tooltip>
          )}
        </Space>
      </div>

      <MetricStrip items={metrics} ariaLabel="Chỉ số Evaluation" />

      {!canReview && (
        <Alert
          type="info"
          showIcon
          title="Bạn đang ở chế độ chỉ xem"
          description="Giảng viên có thể xem kết quả. Chỉ Senior Mentor hoặc Admin được chạy Evaluation mới."
        />
      )}
      {canReview && !readiness.ready && (
        <Alert type="warning" showIcon title="Chưa thể chạy Evaluation" description={readiness.reason} />
      )}
      {canReview && readiness.warning && (
        <Alert type="info" showIcon title="Lưu ý về Rubric" description={readiness.warning} />
      )}

      <EvaluationProgress
        active={runStartedAt > 0}
        elapsedMs={elapsedMs}
        collapsed={progressCollapsed}
        onCollapse={() => setProgressCollapsed(true)}
        onExpand={() => setProgressCollapsed(false)}
      />
      <EvaluationRunsTable
        runs={runs}
        loading={loading}
        error={error}
        onRefresh={onRefresh}
        onOpenDetail={onOpenDetail}
      />
      <EvaluationStartModal
        open={startOpen}
        readiness={readiness}
        pending={pendingAction === 'start-evaluation'}
        onCancel={() => setStartOpen(false)}
        onSubmit={startEvaluation}
      />
      <EvaluationDetailModal
        detail={detail}
        loading={detailLoading}
        onClose={onCloseDetail}
      />
    </section>
  );
}

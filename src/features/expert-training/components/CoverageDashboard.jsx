import { useState } from 'react';
import { Alert, Button, Card, Col, Row, Space, Statistic } from 'antd';
import { Radar, RefreshCw } from 'lucide-react';
import CoverageAnalyzeModal from './coverage/CoverageAnalyzeModal';
import CoverageGapTable from './coverage/CoverageGapTable';

export default function CoverageDashboard({
  gaps,
  chapters = [],
  selectedChapters = [],
  compact = false,
  loading,
  error,
  canReview,
  pendingAction,
  onAnalyze,
  onRefresh,
  onCreateTaskFromGap,
}) {
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const confirmedChapterCount = chapters.filter((chapter) => chapter.status === 'CONFIRMED').length;
  const canAnalyze = selectedChapters.length > 0 || confirmedChapterCount > 0;
  const openGaps = gaps.filter((item) => ['OPEN', 'TASK_CREATED'].includes(item.status)).length;
  const criticalGaps = gaps.filter((item) => item.severity === 'CRITICAL').length;
  const resolvedGaps = gaps.filter((item) => item.status === 'RESOLVED').length;

  return (
    <section className="expert-training__section" aria-labelledby="coverage-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="coverage-heading">Độ phủ tri thức theo chương</h2>
          <p>Phát hiện chương đang thiếu Training Gold Q&A hoặc Evaluation holdout đáng tin cậy.</p>
        </div>
        <Space wrap>
          <Button icon={<RefreshCw size={16} />} onClick={onRefresh} loading={loading}>Làm mới</Button>
          {canReview && (
            <Button
              type="primary"
              icon={<Radar size={16} />}
              onClick={() => setAnalyzeOpen(true)}
              disabled={!canAnalyze}
              title={canAnalyze
                ? 'Phân tích chapter đang chọn hoặc đã xác nhận'
                : 'Xác nhận ít nhất một chapter trước'}
            >
              Phân tích độ phủ
            </Button>
          )}
        </Space>
      </div>

      {!compact && (
        <Row gutter={[12, 12]} className="expert-training__stats">
          <Col xs={12} lg={6}><Card size="small"><Statistic title="Thiếu hụt phát hiện" value={gaps.length} /></Card></Col>
          <Col xs={12} lg={6}><Card size="small"><Statistic title="Đang mở hoặc đã tạo task" value={openGaps} /></Card></Col>
          <Col xs={12} lg={6}><Card size="small"><Statistic title="Nghiêm trọng" value={criticalGaps} /></Card></Col>
          <Col xs={12} lg={6}><Card size="small"><Statistic title="Đã xử lý" value={resolvedGaps} /></Card></Col>
        </Row>
      )}

      {!canReview && (
        <Alert
          type="info"
          showIcon
          title="Senior Mentor hoặc Admin quản lý phân tích độ phủ"
          description="Giảng viên có thể xem thiếu hụt, nhận task và gửi nội dung đóng góp."
        />
      )}

      <CoverageGapTable
        gaps={gaps}
        loading={loading}
        error={error}
        canReview={canReview}
        pendingAction={pendingAction}
        onRefresh={onRefresh}
        onCreateTask={onCreateTaskFromGap}
      />
      <CoverageAnalyzeModal
        open={analyzeOpen}
        chapters={chapters}
        selectedChapters={selectedChapters}
        pending={pendingAction === 'analyze-coverage'}
        onCancel={() => setAnalyzeOpen(false)}
        onAnalyze={onAnalyze}
      />
    </section>
  );
}

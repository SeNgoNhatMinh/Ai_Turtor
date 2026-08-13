import { Card, Col, Row, Statistic } from 'antd';

const METRICS = [
  { key: 'requestCount', label: 'Lượt yêu cầu' },
  { key: 'completedCount', label: 'Đã hoàn tất' },
  { key: 'inProgressCount', label: 'Đang xử lý' },
  { key: 'estimatedTokenCount', label: 'Token ước tính' },
];

export default function AiLogMetrics({ summary = {} }) {
  return (
    <Row gutter={[16, 16]} className="admin-ai-logs-metrics">
      {METRICS.map((metric) => (
        <Col key={metric.key} xs={24} sm={12} lg={6}>
          <Card className="admin-ai-logs-metric">
            <Statistic title={metric.label} value={summary[metric.key] || 0} />
          </Card>
        </Col>
      ))}
    </Row>
  );
}

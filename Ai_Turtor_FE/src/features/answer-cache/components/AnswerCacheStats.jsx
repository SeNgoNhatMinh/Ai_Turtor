import { Card, Col, Row, Statistic } from 'antd';

const STATUS_LABELS = {
  ACTIVE: 'Đang dùng',
  SENIOR_APPROVED: 'Senior duyệt',
  SENIOR_CORRECTED: 'Đã sửa',
  DISABLED: 'Đã tắt',
};

export default function AnswerCacheStats({ stats }) {
  const byStatus = stats?.byReviewStatus || {};
  const items = Object.entries(STATUS_LABELS).map(([key, label]) => ({
    key,
    label,
    value: Number(byStatus[key]) || 0,
  }));

  return (
    <Row gutter={[16, 16]} className="answer-cache-stats">
      <Col xs={24} sm={12} md={6}>
        <Card size="small">
          <Statistic title="Tổng cache" value={Number(stats?.total) || 0} />
        </Card>
      </Col>
      {items.map((item) => (
        <Col xs={24} sm={12} md={6} key={item.key}>
          <Card size="small">
            <Statistic title={item.label} value={item.value} />
          </Card>
        </Col>
      ))}
    </Row>
  );
}

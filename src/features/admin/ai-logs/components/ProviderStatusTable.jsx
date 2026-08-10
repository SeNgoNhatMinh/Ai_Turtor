import { Card, Table, Tag, Typography } from 'antd';

const { Text } = Typography;

const COLUMNS = [
  { title: 'Provider', dataIndex: 'provider', width: 170, render: (value) => <Text strong>{value}</Text> },
  { title: 'Model', dataIndex: 'model', ellipsis: true },
  { title: 'Lần gọi', dataIndex: 'attempts', width: 85 },
  { title: 'Thành công', dataIndex: 'successes', width: 100 },
  {
    title: 'Lỗi quota',
    dataIndex: 'quotaFailures',
    width: 90,
    render: (value) => <Tag color={value ? 'error' : 'success'}>{value || 0}</Tag>,
  },
  { title: 'Bỏ qua do cooldown', dataIndex: 'skippedDuringCooldown', width: 135 },
  {
    title: 'Trạng thái',
    key: 'providerStatus',
    width: 120,
    render: (_, row) => row.coolingDown
      ? <Tag color="warning">Đang nghỉ</Tag>
      : <Tag color="success">Sẵn sàng</Tag>,
  },
];

export default function ProviderStatusTable({ providers, loading }) {
  return (
    <Card
      className="admin-ai-logs-section-card"
      title="Trạng thái LLM API và local"
      extra={<Text type="secondary">Tính từ lần khởi động Backend gần nhất</Text>}
    >
      <Table
        size="small"
        rowKey="provider"
        dataSource={providers}
        loading={loading}
        pagination={false}
        scroll={{ x: 900 }}
        columns={COLUMNS}
      />
    </Card>
  );
}

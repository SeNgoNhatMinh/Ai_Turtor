import { Card, Space, Tag, Typography } from 'antd';
import SearchableTable from '../../../../components/common/SearchableTable';

const { Text } = Typography;

export default function ProviderStatusTable({ providers, providerConfigs, loading }) {
  const configById = new Map(
    (providerConfigs || []).map((config, index) => [config.providerId, { ...config, order: index }]),
  );
  const rows = [...(providers || [])].sort((left, right) => {
    const leftOrder = configById.get(left.provider)?.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = configById.get(right.provider)?.order ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });

  const columns = [
    {
      title: 'Provider',
      dataIndex: 'provider',
      width: 220,
      render: (value) => {
        const config = configById.get(value);
        return (
          <Space orientation="vertical" size={2}>
            <Text strong>{config?.label || value}</Text>
            <Text type="secondary">{value}</Text>
            {value === 'groq-worker1' && <Tag color="blue">Worker 1 · ưu tiên cao nhất</Tag>}
          </Space>
        );
      },
    },
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

  return (
    <Card
      className="admin-ai-logs-section-card"
      title="Thống kê runtime theo provider"
      extra={<Text type="secondary">Tính từ lần khởi động Backend gần nhất</Text>}
    >
      <SearchableTable
        size="small"
        rowKey="provider"
        dataSource={rows}
        loading={loading}
        pagination={false}
        searchKeys={['provider', 'model']}
        searchPlaceholder="Tìm theo provider hoặc model"
        scroll={{ x: 900 }}
        columns={columns}
      />
    </Card>
  );
}

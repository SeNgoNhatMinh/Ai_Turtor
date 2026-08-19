import { Card, Table, Tag, Typography } from 'antd';

const { Text } = Typography;

const HIT_LABELS = {
  EXACT: 'Exact',
  SEMANTIC_EARLY: 'Semantic sớm',
  SEMANTIC_VERIFIED: 'Semantic đã kiểm chứng',
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('vi-VN');
};

export default function CacheHitAuditTable({ hits = [], loading = false }) {
  const columns = [
    {
      title: 'Thời điểm',
      dataIndex: 'createdAt',
      width: 170,
      render: formatDateTime,
    },
    {
      title: 'Loại cache hit',
      dataIndex: 'hitType',
      width: 170,
      render: (value) => (
        value ? <Tag color={value === 'EXACT' ? 'green' : 'blue'}>{HIT_LABELS[value] || value}</Tag> : '—'
      ),
    },
    {
      title: 'Similarity',
      dataIndex: 'similarity',
      width: 100,
      render: (value) => (Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '—'),
    },
    {
      title: 'Cache lookup',
      dataIndex: 'cacheLookupMs',
      width: 120,
      render: (value) => (Number.isFinite(value) ? `${value} ms` : '—'),
    },
    {
      title: 'Backend xử lý',
      dataIndex: 'backendProcessingMs',
      width: 130,
      render: (value) => (Number.isFinite(value) ? `${value} ms` : '—'),
    },
    {
      title: 'Cache ID',
      dataIndex: 'matchedCacheId',
      ellipsis: true,
      render: (value) => <Text code copyable={Boolean(value)}>{value || '—'}</Text>,
    },
  ];

  return (
    <Card
      className="answer-cache-table-card"
      title="Log cache đã phục vụ học sinh"
      extra={<Text type="secondary">Thời gian Backend, không gồm truyền mạng</Text>}
    >
      <Table
        rowKey={(row) => row.id || `${row.matchedCacheId}-${row.createdAt}`}
        size="small"
        loading={loading}
        dataSource={hits}
        columns={columns}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        locale={{ emptyText: 'Chưa ghi nhận cache hit cho môn học này.' }}
      />
    </Card>
  );
}

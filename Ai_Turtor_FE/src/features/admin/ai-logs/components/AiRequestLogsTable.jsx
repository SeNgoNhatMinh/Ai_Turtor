import { Card, Space, Tag, Typography } from 'antd';
import SearchableTable from '../../../../components/common/SearchableTable';

const { Paragraph, Text } = Typography;

const formatDateTime = (value) => (
  value ? new Date(value).toLocaleString('vi-VN') : '—'
);

const COLUMNS = [
  { title: 'Thời gian', dataIndex: 'createdAt', width: 170, render: formatDateTime },
  {
    title: 'Mã sinh viên',
    dataIndex: 'studentCode',
    key: 'studentCode',
    width: 140,
    render: (value) => value || '—',
  },
  {
    title: 'Môn/lớp',
    key: 'scope',
    width: 150,
    render: (_, row) => [row.courseId, row.classId].filter(Boolean).join(' / ') || '—',
  },
  { title: 'Câu hỏi', dataIndex: 'question', ellipsis: true },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    width: 120,
    render: (value) => {
      if (value === 'COMPLETED') return <Tag color="success">Hoàn tất</Tag>;
      if (value === 'FAILED') return <Tag color="error">Không trả lời</Tag>;
      if (value === 'INCOMPLETE') return <Tag color="warning">Trả lời thiếu</Tag>;
      return <Tag color="processing">Đang xử lý</Tag>;
    },
  },
  { title: 'Token đã dùng (ước tính)', dataIndex: 'totalTokensEstimated', width: 175 },
  { title: 'Chi phí thực', dataIndex: 'actualCost', width: 110, render: (value) => value == null ? 'Chưa có' : value },
];

const renderExpandedLog = (row) => (
  <Space orientation="vertical" className="admin-ai-log-answer">
    <Text strong>Câu trả lời</Text>
    <Paragraph>{row.answer || 'Chưa có câu trả lời.'}</Paragraph>
    <Text type="secondary">
      Ước tính đầu vào: {row.inputTokensEstimated || 0} · đầu ra: {row.outputTokensEstimated || 0} token.
      Đây là lượng đã dùng, không phải hạn mức trả lời.
    </Text>
    {row.costNote && <Text type="secondary">{row.costNote}</Text>}
  </Space>
);

export default function AiRequestLogsTable({ logs, loading, pagination, query, onSearch }) {
  return (
    <Card className="admin-ai-logs-section-card" title="Lịch sử yêu cầu">
      <SearchableTable
        rowKey={(row, index) => `${row.conversationId}-${row.createdAt}-${index}`}
        dataSource={logs}
        loading={loading}
        searchPlaceholder="Tìm theo sinh viên, câu hỏi hoặc câu trả lời"
        serverPagination={pagination}
        externalQuery={query}
        onServerSearch={onSearch}
        locale={{ emptyText: loading ? 'Đang tải nhật ký...' : 'Không có yêu cầu phù hợp' }}
        scroll={{ x: 980 }}
        expandable={{ expandedRowRender: renderExpandedLog }}
        columns={COLUMNS}
      />
    </Card>
  );
}

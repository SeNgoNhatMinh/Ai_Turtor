import { useMemo, useState } from 'react';
import { Alert, Button, Card, Select, Space, Switch, Tag, Typography } from 'antd';
import { Download, RefreshCw } from 'lucide-react';
import SearchableTable from '../../../../components/common/SearchableTable';

const { Paragraph, Text } = Typography;

const formatDateTime = (value) => (
  value ? new Date(value).toLocaleString('vi-VN') : '—'
);

const STATUS_META = {
  COMPLETED: { label: 'Hoàn tất', color: 'success' },
  FAILED: { label: 'Thất bại', color: 'error' },
  INCOMPLETE: { label: 'Trả lời thiếu', color: 'warning' },
  IN_PROGRESS: { label: 'Đang xử lý', color: 'processing' },
};

const getStatus = (value) => STATUS_META[String(value || '').toUpperCase()] || {
  label: value || 'Chưa rõ',
  color: 'default',
};

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
    width: 140,
    render: (value) => {
      const status = getStatus(value);
      return <Tag color={status.color}>{status.label}</Tag>;
    },
  },
  { title: 'Token ước tính', dataIndex: 'totalTokensEstimated', width: 130 },
  {
    title: 'Chi phí thực',
    dataIndex: 'actualCost',
    width: 110,
    render: (value) => value == null ? 'Chưa có' : value,
  },
];

const csvCell = (value) => {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""').replaceAll('\r', ' ').replaceAll('\n', ' ')}"`;
};

function exportLogs(logs) {
  const headers = ['createdAt', 'studentCode', 'studentName', 'courseId', 'classId', 'status', 'question', 'answer', 'errorMessage', 'totalTokensEstimated'];
  const rows = logs.map((log) => headers.map((key) => csvCell(
    key === 'errorMessage' ? (log.errorMessage || log.failureReason || log.error || '') : log[key],
  )).join(','));
  const csv = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ai-request-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

const renderExpandedLog = (row) => {
  const status = getStatus(row.status);
  const errorMessage = row.errorMessage || row.failureReason || row.error || row.failureDetail;
  const hasAnswer = Boolean(String(row.answer || '').trim());

  return (
    <Space orientation="vertical" size="middle" className="admin-ai-log-answer">
      <Space wrap>
        <Text strong>Chi tiết yêu cầu</Text>
        <Tag color={status.color}>{status.label}</Tag>
        <Text type="secondary">ID hội thoại: {row.conversationId || '—'}</Text>
      </Space>

      <div className="admin-ai-log-process" aria-label="Tóm tắt trạng thái yêu cầu">
        <div className="admin-ai-log-process-step admin-ai-log-process-step--done">
          <span className="admin-ai-log-process-dot" />
          <div>
            <Text strong>Đã ghi nhận câu hỏi</Text>
            <Text type="secondary">{formatDateTime(row.createdAt)}</Text>
          </div>
        </div>
        <div className={`admin-ai-log-process-step ${hasAnswer ? 'admin-ai-log-process-step--done' : 'admin-ai-log-process-step--pending'}`}>
          <span className="admin-ai-log-process-dot" />
          <div>
            <Text strong>{hasAnswer ? 'Đã lưu phản hồi' : 'Chưa có phản hồi được lưu'}</Text>
            <Text type="secondary">
              {hasAnswer ? 'Có nội dung assistant trong lịch sử hội thoại.' : 'Yêu cầu có thể vẫn đang xử lý hoặc đã dừng trước khi lưu câu trả lời.'}
            </Text>
          </div>
        </div>
      </div>

      {['FAILED', 'INCOMPLETE'].includes(String(row.status || '').toUpperCase()) && (
        <Alert
          type={row.status === 'FAILED' ? 'error' : 'warning'}
          showIcon
          message={row.status === 'FAILED' ? 'Yêu cầu thất bại' : 'Câu trả lời chưa đầy đủ'}
          description={errorMessage
            ? String(errorMessage)
            : 'API nhật ký hiện chỉ trả trạng thái tổng quát, chưa cung cấp nguyên nhân lỗi, provider/model đã gọi hoặc từng bước RAG. Cần bổ sung trace từ backend để chẩn đoán chính xác.'}
        />
      )}

      <div>
        <Text strong>Câu hỏi</Text>
        <Paragraph>{row.question || 'Không có nội dung câu hỏi.'}</Paragraph>
      </div>
      <div>
        <Text strong>Câu trả lời</Text>
        <Paragraph>{row.answer || 'Chưa có câu trả lời.'}</Paragraph>
      </div>
      <Text type="secondary">
        Token ước tính: đầu vào {row.inputTokensEstimated || 0} · đầu ra {row.outputTokensEstimated || 0} · tổng {row.totalTokensEstimated || 0}.
        {row.costNote ? ` ${row.costNote}` : ''}
      </Text>
    </Space>
  );
};

export default function AiRequestLogsTable({
  logs,
  loading,
  pagination,
  query,
  onSearch,
  onRefresh,
  autoRefresh,
  onAutoRefreshChange,
}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const visibleLogs = useMemo(() => (
    statusFilter === 'ALL'
      ? logs
      : logs.filter((row) => String(row.status || '').toUpperCase() === statusFilter)
  ), [logs, statusFilter]);

  return (
    <Card
      className="admin-ai-logs-section-card"
      title="Lịch sử yêu cầu"
      extra={(
        <Space wrap>
          <Space size={6}>
            <Text>Live</Text>
            <Switch
              checked={autoRefresh}
              onChange={onAutoRefreshChange}
              size="small"
              aria-label="Bật tự làm mới nhật ký"
            />
          </Space>
          <Select
            aria-label="Lọc trạng thái nhật ký"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: 'Tất cả trạng thái', value: 'ALL' },
              { label: 'Thất bại', value: 'FAILED' },
              { label: 'Trả lời thiếu', value: 'INCOMPLETE' },
              { label: 'Đang xử lý', value: 'IN_PROGRESS' },
              { label: 'Hoàn tất', value: 'COMPLETED' },
            ]}
            style={{ minWidth: 165 }}
          />
          <Button
            icon={<RefreshCw size={15} />}
            onClick={onRefresh}
            loading={loading}
          >
            Làm mới
          </Button>
          <Button
            icon={<Download size={15} />}
            onClick={() => exportLogs(visibleLogs)}
            disabled={!visibleLogs.length}
          >
            Xuất CSV
          </Button>
        </Space>
      )}
    >
      {autoRefresh && (
        <Alert
          className="admin-ai-logs-live-hint"
          type="info"
          showIcon
          message="Tự làm mới đang bật — dữ liệu được tải lại mỗi 15 giây."
        />
      )}
      {statusFilter !== 'ALL' && (
        <div className="admin-ai-logs-filter-note">
          Đang lọc trên trang dữ liệu hiện tại ({visibleLogs.length}/{logs.length} bản ghi). Đổi trang để kiểm tra các bản ghi khác.
        </div>
      )}
      <SearchableTable
        rowKey={(row, index) => `${row.conversationId || 'conversation'}-${row.createdAt || 'unknown'}-${index}`}
        dataSource={visibleLogs}
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

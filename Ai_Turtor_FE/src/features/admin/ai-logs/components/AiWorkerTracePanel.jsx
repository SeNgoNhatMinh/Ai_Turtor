import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Col, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import { adminAiLogsApi } from '../../../../services/adminAiLogsApi';

const { Text } = Typography;
const STATUS = { STARTED: { color: 'processing', label: 'Đang chạy' }, RUNNING: { color: 'processing', label: 'Đang chạy' }, SUCCESS: { color: 'success', label: 'Thành công' }, FAILED: { color: 'error', label: 'Lỗi' }, TIMED_OUT: { color: 'warning', label: 'Timeout' }, REJECTED: { color: 'error', label: 'Bị từ chối' }, SKIPPED: { color: 'default', label: 'Đã bỏ qua' }, CACHED: { color: 'cyan', label: 'Dùng cache' } };
const formatDate = (value) => value ? new Date(value).toLocaleString('vi-VN') : '—';

export default function AiWorkerTracePanel() {
  const query = useQuery({ queryKey: ['admin-ai-worker-traces'], queryFn: ({ signal }) => adminAiLogsApi.getWorkerTraces({ signal }), refetchInterval: 5000, refetchIntervalInBackground: false, staleTime: 0 });
  const rows = Array.isArray(query.data) ? query.data : [];
  const workers = ['worker-1', 'worker-2', 'worker-3'].map((id) => ({ id, latest: rows.find((event) => event.workerId === id) || null, count: rows.filter((event) => event.workerId === id).length }));
  const columns = [
    { title: 'Thời điểm', dataIndex: 'createdAt', width: 180, render: formatDate },
    { title: 'Trace ID', dataIndex: 'traceId', width: 250, render: (value) => <Text copyable={{ text: value }}>{value || '—'}</Text> },
    { title: 'Worker', dataIndex: 'workerName', width: 190, render: (value, row) => value || row.workerId },
    { title: 'Bước', dataIndex: 'stage', width: 130 },
    { title: 'Trạng thái', dataIndex: 'status', width: 140, render: (value) => { const s = STATUS[String(value || '').toUpperCase()] || { color: 'default', label: value || 'Chưa rõ' }; return <Tag color={s.color}>{s.label}</Tag>; } },
    { title: 'Model', dataIndex: 'model', width: 260, render: (value) => value || 'Chưa ghi nhận' },
    { title: 'Thời gian', dataIndex: 'durationMs', width: 110, render: (value) => value == null ? '—' : `${value} ms` },
    { title: 'Chi tiết', dataIndex: 'detail', render: (value) => value || '—' },
  ];
  return (
    <Card title="Giám sát 3 Worker" extra={<Text type="secondary">Tự làm mới mỗi 5 giây</Text>} style={{ marginBottom: 16 }}>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} message="Nhật ký thực từ backend" description="Worker 1 là pipeline sinh câu trả lời; Worker 2 kiểm tra độ chính xác và mức độ bám sát tài liệu của bản nháp; Worker 3 hoàn thiện câu trả lời cuối dựa trên báo cáo kiểm tra. Yêu cầu bị policy chặn hoặc trả từ cache có thể không chạy đủ cả ba; bảng ghi rõ trạng thái thay vì giả lập thành công." />
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {workers.map(({ id, latest, count }) => <Col xs={24} md={8} key={id}><Card size="small"><Space direction="vertical" size={4} style={{ width: '100%' }}><Text strong>{id === 'worker-1' ? 'Worker 1 · Answer Generation' : id === 'worker-2' ? 'Worker 2 · Grounding & Accuracy Reviewer' : 'Worker 3 · Final Answer Refiner'}</Text><Statistic title="Sự kiện đã ghi" value={count} /><Text type="secondary">Trạng thái mới nhất: {latest ? (STATUS[String(latest.status || '').toUpperCase()]?.label || latest.status) : 'Chưa có event'}</Text><Text type="secondary">Cập nhật: {formatDate(latest?.createdAt)}</Text></Space></Card></Col>)}
      </Row>
      {query.isError && <Alert type="error" showIcon message="Không tải được worker traces" description="Kiểm tra backend đã deploy endpoint /api/admin/ai-worker-traces và tài khoản hiện tại có quyền Admin." style={{ marginBottom: 12 }} />}
      <Table rowKey={(row) => row.id || `${row.traceId}-${row.workerId}-${row.createdAt}-${row.stage}`} size="small" loading={query.isPending} columns={columns} dataSource={rows} scroll={{ x: 1450 }} pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: [15, 30, 50] }} />
    </Card>
  );
}
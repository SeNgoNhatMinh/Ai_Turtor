import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, DatePicker, Form, Input, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import { RefreshCw, Search } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import { adminAiLogsApi } from '../../../services/adminAiLogsApi';
import { getUserFacingError } from '../../../services/apiClient';

const { Paragraph, Text } = Typography;

export default function AdminAiLogsPage() {
  const [form] = Form.useForm();
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({});
  const [providerStats, setProviderStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (values = {}) => {
    setLoading(true);
    setError('');
    try {
      const range = values.range || [];
      const [data, providerData] = await Promise.all([
        adminAiLogsApi.getLogs({
        studentId: values.studentId,
        courseId: values.courseId,
        q: values.q,
        from: range[0]?.toISOString?.(),
        to: range[1]?.toISOString?.(),
        }),
        adminAiLogsApi.getProviderStats().catch(() => null),
      ]);
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
      setSummary(data?.summary || {});
      setProviderStats(Array.isArray(providerData?.providers) ? providerData.providers : []);
    } catch (reason) {
      setLogs([]);
      setSummary({});
      const permissionMessage = reason?.status === 401 || reason?.status === 403
        ? 'API nhật ký AI chưa chấp nhận quyền Admin hiện tại. Phiên đăng nhập của bạn vẫn được giữ nguyên.'
        : 'Không thể tải nhật ký hỏi đáp AI.';
      setError(getUserFacingError(reason, permissionMessage));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div className="portal-section admin-route-page">
      <PageHeader eyebrow="Giám sát AI" title="Nhật ký hỏi đáp AI" description="Theo dõi câu hỏi, câu trả lời, tiến trình và mức sử dụng ước tính của sinh viên." />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} lg={6}><Card><Statistic title="Lượt yêu cầu" value={summary.requestCount || 0} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="Đã hoàn tất" value={summary.completedCount || 0} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="Đang xử lý" value={summary.inProgressCount || 0} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="Token ước tính" value={summary.estimatedTokenCount || 0} /></Card></Col>
      </Row>
      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={load}>
          <Form.Item name="q"><Input allowClear prefix={<Search size={14} />} placeholder="Tìm câu hỏi hoặc câu trả lời" /></Form.Item>
          <Form.Item name="studentId"><Input allowClear placeholder="Mã sinh viên" /></Form.Item>
          <Form.Item name="courseId"><Input allowClear placeholder="Mã môn học" /></Form.Item>
          <Form.Item name="range"><DatePicker.RangePicker showTime /></Form.Item>
          <Form.Item><Space><Button type="primary" htmlType="submit" loading={loading}>Lọc</Button><Button icon={<RefreshCw size={14} />} onClick={() => { form.resetFields(); load(); }}>Làm mới</Button></Space></Form.Item>
        </Form>
      </Card>
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
      <Card title="Trạng thái LLM API và local" style={{ marginBottom: 16 }} extra={<Text type="secondary">Tính từ lần khởi động Backend gần nhất</Text>}>
        <Table
          size="small"
          rowKey="provider"
          dataSource={providerStats}
          pagination={false}
          scroll={{ x: 900 }}
          columns={[
            { title: 'Provider', dataIndex: 'provider', width: 170, render: (value) => <Text strong>{value}</Text> },
            { title: 'Model', dataIndex: 'model', ellipsis: true },
            { title: 'Lần gọi', dataIndex: 'attempts', width: 85 },
            { title: 'Thành công', dataIndex: 'successes', width: 100 },
            { title: 'Lỗi quota', dataIndex: 'quotaFailures', width: 90, render: (value) => <Tag color={value ? 'error' : 'success'}>{value || 0}</Tag> },
            { title: 'Bỏ qua do cooldown', dataIndex: 'skippedDuringCooldown', width: 135 },
            {
              title: 'Trạng thái',
              key: 'providerStatus',
              width: 120,
              render: (_, row) => row.coolingDown ? <Tag color="warning">Đang nghỉ</Tag> : <Tag color="success">Sẵn sàng</Tag>,
            },
          ]}
        />
      </Card>
      <Card>
        <Table
          rowKey={(row, index) => `${row.conversationId}-${row.createdAt}-${index}`}
          dataSource={logs}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1000 }}
          expandable={{
            expandedRowRender: (row) => (
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Text strong>Câu trả lời</Text>
                <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{row.answer || 'Chưa có câu trả lời.'}</Paragraph>
                <Text type="secondary">{row.costNote}</Text>
              </Space>
            ),
          }}
          columns={[
            { title: 'Thời gian', dataIndex: 'createdAt', width: 170, render: (v) => v ? new Date(v).toLocaleString('vi-VN') : '—' },
            { title: 'Sinh viên', dataIndex: 'studentId', width: 130 },
            { title: 'Môn/lớp', key: 'scope', width: 150, render: (_, r) => [r.courseId, r.classId].filter(Boolean).join(' / ') || '—' },
            { title: 'Câu hỏi', dataIndex: 'question', ellipsis: true },
            { title: 'Trạng thái', dataIndex: 'status', width: 120, render: (v) => <Tag color={v === 'COMPLETED' ? 'success' : 'processing'}>{v === 'COMPLETED' ? 'Hoàn tất' : 'Đang xử lý'}</Tag> },
            { title: 'Token (ước tính)', dataIndex: 'totalTokensEstimated', width: 140 },
            { title: 'Chi phí thực', dataIndex: 'actualCost', width: 110, render: (v) => v == null ? 'Chưa có' : v },
          ]}
        />
      </Card>
    </div>
  );
}

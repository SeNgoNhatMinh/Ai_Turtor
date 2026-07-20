import React from 'react';
import { Row, Col, Card, Statistic, Space, Alert, Button, Typography, Tag, Tabs, Table, Input } from 'antd';
import {
  Users, GraduationCap, Library, AlertTriangle, RefreshCw, Server, FileText,
  BookOpenCheck, ShieldCheck,
} from 'lucide-react';
import { diagnosticsApi } from '../../services/diagnosticsApi';
import { env } from '../../config/env';
import { getUserFacingError } from '../../services/apiClient';
import ActionQueue from '../../components/common/ActionQueue';

const { Text } = Typography;

function AdminDashboard({
  adminStats = {},
  diagnosticsOutput,
  isDiagnosticsRunning,
  runDiagnostics,
  onNavigate,
}) {
  const [logs, setLogs] = React.useState([]);
  const [logsLoading, setLogsLoading] = React.useState(false);
  const [logsError, setLogsError] = React.useState('');
  const [traceId, setTraceId] = React.useState('');
  const [traceOutput, setTraceOutput] = React.useState(null);
  const [traceError, setTraceError] = React.useState('');

  const loadLogs = async () => {
    setLogsLoading(true);
    setLogsError('');
    try {
      const data = await diagnosticsApi.getHarnessLogs({ limit: 50 });
      setLogs(Array.isArray(data) ? data : data?.content || data?.logs || []);
    } catch (error) {
      setLogs([]);
      setLogsError(getUserFacingError(error, 'Không thể tải nhật ký AI Harness.'));
    } finally {
      setLogsLoading(false);
    }
  };

  const loadTrace = async (requestedTraceId = traceId) => {
    if (!requestedTraceId) return;
    setLogsLoading(true);
    setTraceError('');
    setTraceOutput(null);
    try {
      const data = await diagnosticsApi.getTraceLogs(requestedTraceId);
      setTraceOutput(data);
    } catch (error) {
      setTraceError(getUserFacingError(error, 'Không thể tải trace này.'));
    } finally {
      setLogsLoading(false);
    }
  };

  React.useEffect(() => {
    const loadTimer = window.setTimeout(loadLogs, 0);
    return () => window.clearTimeout(loadTimer);
  }, []);

  const harnessLabel = env.n8nEnabled
    ? env.n8nStrict ? 'n8n strict' : 'Đã bật n8n harness'
    : 'Gọi backend trực tiếp';
  const harnessColor = env.n8nEnabled ? 'processing' : 'default';
  const diagnosticsTabs = [
    {
      key: 'health',
      label: <><Server size={14} style={{ marginRight: 6 }} />Trạng thái hệ thống</>,
      children: (
        <Card
          title="Kiểm tra kết nối dịch vụ"
          extra={(
            <Space>
              <Tag color={harnessColor}>{harnessLabel}</Tag>
              <Button
                type="primary"
                icon={<RefreshCw size={14} className={isDiagnosticsRunning ? 'spinning' : ''} />}
                onClick={runDiagnostics}
                loading={isDiagnosticsRunning}
              >
                Kiểm tra
              </Button>
            </Space>
          )}
          hoverable
        >
          {diagnosticsOutput ? (
            <Space orientation="vertical" style={{ width: '100%' }} size="middle">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Khóa OpenRouter:</Text>
                <Tag color={diagnosticsOutput.apiKeyValid ? 'success' : 'error'}>
                  {diagnosticsOutput.apiKeyValid ? 'Hợp lệ' : 'Có lỗi'}
                </Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Kết nối OpenRouter:</Text>
                <Tag color={diagnosticsOutput.openRouterConnectivity ? 'success' : 'error'}>
                  {diagnosticsOutput.openRouterConnectivity ? 'Đã kết nối' : 'Ngoại tuyến'}
                </Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Ollama (Embedding):</Text>
                <Tag color={diagnosticsOutput.ollamaConnectivity ? 'success' : 'error'}>
                  {diagnosticsOutput.ollamaConnectivity ? 'Trực tuyến' : 'Ngoại tuyến'}
                </Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Mô hình LLM:</Text>
                <Text strong>{diagnosticsOutput.configDetails?.activeModel || 'Chưa xác định'}</Text>
              </div>
            </Space>
          ) : (
            <Alert title="Bấm Kiểm tra để xác minh kết nối AI và cơ sở dữ liệu." type="info" showIcon />
          )}
        </Card>
      ),
    },
    {
      key: 'logs',
      label: <><FileText size={14} style={{ marginRight: 6 }} />Nhật ký & trace</>,
      children: (
        <>
          <Card
            title="Nhật ký AI Harness"
            hoverable
            extra={<Button size="small" onClick={loadLogs} icon={<RefreshCw size={14} />}>Làm mới</Button>}
            style={{ marginBottom: 16 }}
          >
            {logsError && (
              <Alert
                type="warning"
                showIcon
                title={logsError}
                action={<Button size="small" onClick={loadLogs}>Thử lại</Button>}
                style={{ marginBottom: 12 }}
              />
            )}
            <Table
              dataSource={logs}
              rowKey={(record, index) => record.id || record.timestamp || record.traceId || `log-${index}`}
              size="small"
              loading={logsLoading}
              pagination={{ pageSize: 5 }}
              columns={[
                { title: 'Thời gian', dataIndex: 'timestamp', key: 'time', render: (value) => value ? new Date(value).toLocaleString('vi-VN') : '—' },
                { title: 'Mức độ', dataIndex: 'level', key: 'level', render: (value) => <Tag color={value === 'ERROR' ? 'red' : value === 'WARN' ? 'orange' : 'blue'}>{value || 'INFO'}</Tag> },
                { title: 'Nội dung', dataIndex: 'message', key: 'msg', ellipsis: true },
                {
                  title: 'Mã trace',
                  dataIndex: 'traceId',
                  key: 'traceId',
                  render: (value) => value ? (
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setTraceId(value);
                        loadTrace(value);
                      }}
                    >
                      {value}
                    </Button>
                  ) : '—',
                },
              ]}
            />
          </Card>
          <Card title="Xem chi tiết trace" hoverable>
            <Space style={{ width: '100%', marginBottom: 16 }}>
              <Input
                placeholder="Nhập mã trace"
                value={traceId}
                onChange={(event) => setTraceId(event.target.value)}
                style={{ width: 300 }}
              />
              <Button type="primary" onClick={() => loadTrace()} loading={logsLoading} disabled={!traceId.trim()}>Tải trace</Button>
            </Space>
            {traceError && <Alert type="warning" showIcon title={traceError} style={{ marginBottom: 12 }} />}
            {traceOutput && (
              <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, maxHeight: 300, overflow: 'auto', fontSize: 12 }}>
                {JSON.stringify(traceOutput, null, 2)}
              </pre>
            )}
          </Card>
        </>
      ),
    },
  ];

  return (
    <div className="portal-view">
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} lg={6}>
          <Card hoverable className="glass-card" style={{ borderLeft: '3px solid #F37021' }}>
            <Statistic
              title={<Text type="secondary">Tổng tài khoản</Text>}
              value={adminStats.users ?? adminStats.totalUsers ?? 0}
              styles={{ content: { color: '#F37021', fontWeight: 700 } }}
              prefix={<Users size={20} />}
            />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card hoverable className="glass-card" style={{ borderLeft: '3px solid #52c41a' }}>
            <Statistic
              title={<Text type="secondary">Giảng viên</Text>}
              value={adminStats.mentors ?? 0}
              styles={{ content: { color: '#52c41a', fontWeight: 700 } }}
              prefix={<GraduationCap size={20} />}
            />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card hoverable className="glass-card" style={{ borderLeft: '3px solid #F37021' }}>
            <Statistic
              title={<Text type="secondary">Môn học</Text>}
              value={adminStats.courses ?? adminStats.totalCourses ?? 0}
              styles={{ content: { color: '#F37021', fontWeight: 700 } }}
              prefix={<Library size={20} />}
            />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card hoverable className="glass-card" style={{ borderLeft: '3px solid #fa8c16' }}>
            <Statistic
              title={<Text type="secondary">Yêu cầu hỗ trợ</Text>}
              value={adminStats.escalations ?? 0}
              styles={{ content: { color: '#fa8c16', fontWeight: 700 } }}
              prefix={<AlertTriangle size={20} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Việc quản trị cần xử lý" hoverable>
            <ActionQueue
              items={[
                {
                  key: 'users',
                  title: 'Quản lý tài khoản và giảng viên',
                  description: 'Kiểm tra vai trò, trạng thái tài khoản và dữ liệu import.',
                  icon: Users,
                  onClick: () => onNavigate?.('/admin/users'),
                },
                {
                  key: 'academic',
                  title: 'Quản lý học kỳ, lớp và học liệu',
                  description: 'Cập nhật môn học, lớp học phần, ghi danh và tài liệu dùng chung.',
                  icon: BookOpenCheck,
                  onClick: () => onNavigate?.('/admin/academic'),
                },
                {
                  key: 'knowledge',
                  title: 'Kiểm duyệt tri thức AI',
                  description: 'Xử lý nội dung chờ duyệt trước khi đưa vào RAG.',
                  icon: ShieldCheck,
                  onClick: () => onNavigate?.('/admin/expert-training'),
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Tabs defaultActiveKey="health" type="card" items={diagnosticsTabs} />
        </Col>
      </Row>
    </div>
  );
}

export default AdminDashboard;

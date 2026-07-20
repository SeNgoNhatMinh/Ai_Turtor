import React from 'react';
import { Row, Col, Card, Statistic, Space, Alert, Button, Typography, Tag, Tabs, Table, Input } from 'antd';
import {
  BarChart3, Users, GraduationCap, Library, AlertTriangle, RefreshCw, Server, FileText
} from 'lucide-react';
import { diagnosticsApi } from '../../services/diagnosticsApi';
import { env } from '../../config/env';

const { Text } = Typography;

function AdminDashboard({ adminStats = {}, diagnosticsOutput, isDiagnosticsRunning, runDiagnostics }) {
  const [logs, setLogs] = React.useState([]);
  const [logsLoading, setLogsLoading] = React.useState(false);
  const [traceId, setTraceId] = React.useState('');
  const [traceOutput, setTraceOutput] = React.useState(null);

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await diagnosticsApi.getHarnessLogs({ limit: 50 });
      setLogs(Array.isArray(data) ? data : data?.content || data?.logs || []);
    } catch {
      // Backend might not have this endpoint yet, ignore quietly
      setLogs([{ id: '1', level: 'INFO', message: 'Log service unavailable or endpoint missing.' }]);
    } finally {
      setLogsLoading(false);
    }
  };

  const loadTrace = async (requestedTraceId = traceId) => {
    if (!requestedTraceId) return;
    setLogsLoading(true);
    try {
      const data = await diagnosticsApi.getTraceLogs(requestedTraceId);
      setTraceOutput(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLogsLoading(false);
    }
  };

  React.useEffect(() => {
    const loadTimer = window.setTimeout(loadLogs, 0);
    return () => window.clearTimeout(loadTimer);
  }, []);

  const harnessLabel = env.n8nEnabled
    ? env.n8nStrict ? 'Full n8n strict' : 'n8n harness enabled'
    : 'Backend direct';
  const harnessColor = env.n8nEnabled ? 'processing' : 'default';
  const diagnosticsTabs = [
    {
      key: 'health',
      label: <><Server size={14} style={{ marginRight: 6 }} />System Health</>,
      children: (
        <Card
          title="System Diagnostics"
          extra={(
            <Space>
              <Tag color={harnessColor}>{harnessLabel}</Tag>
              <Button
                type="primary"
                icon={<RefreshCw size={14} className={isDiagnosticsRunning ? 'spinning' : ''} />}
                onClick={runDiagnostics}
                loading={isDiagnosticsRunning}
              >
                Run Check
              </Button>
            </Space>
          )}
          hoverable
        >
          {diagnosticsOutput ? (
            <Space orientation="vertical" style={{ width: '100%' }} size="middle">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>OpenRouter API Key:</Text>
                <Tag color={diagnosticsOutput.apiKeyValid ? 'success' : 'error'}>
                  {diagnosticsOutput.apiKeyValid ? 'Valid' : 'Error'}
                </Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>OpenRouter Connection:</Text>
                <Tag color={diagnosticsOutput.openRouterConnectivity ? 'success' : 'error'}>
                  {diagnosticsOutput.openRouterConnectivity ? 'Connected' : 'Offline'}
                </Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Ollama (Embedding):</Text>
                <Tag color={diagnosticsOutput.ollamaConnectivity ? 'success' : 'error'}>
                  {diagnosticsOutput.ollamaConnectivity ? 'Online' : 'Offline'}
                </Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>LLM Model:</Text>
                <Text strong>{diagnosticsOutput.configDetails?.activeModel || 'N/A'}</Text>
              </div>
            </Space>
          ) : (
            <Alert title="Click 'Run Check' to verify AI and database connectivity." type="info" showIcon />
          )}
        </Card>
      ),
    },
    {
      key: 'logs',
      label: <><FileText size={14} style={{ marginRight: 6 }} />Harness Logs & Traces</>,
      children: (
        <>
          <Card
            title="Harness Logs"
            hoverable
            extra={<Button size="small" onClick={loadLogs} icon={<RefreshCw size={14} />}>Reload</Button>}
            style={{ marginBottom: 16 }}
          >
            <Table
              dataSource={logs}
              rowKey={(record, index) => record.id || record.timestamp || record.traceId || `log-${index}`}
              size="small"
              loading={logsLoading}
              pagination={{ pageSize: 5 }}
              columns={[
                { title: 'Time', dataIndex: 'timestamp', key: 'time', render: (value) => value ? new Date(value).toLocaleString() : '—' },
                { title: 'Level', dataIndex: 'level', key: 'level', render: (value) => <Tag color={value === 'ERROR' ? 'red' : value === 'WARN' ? 'orange' : 'blue'}>{value}</Tag> },
                { title: 'Message', dataIndex: 'message', key: 'msg', ellipsis: true },
                {
                  title: 'Trace ID',
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
          <Card title="View Memory Trace" hoverable>
            <Space style={{ width: '100%', marginBottom: 16 }}>
              <Input
                placeholder="Enter Trace ID"
                value={traceId}
                onChange={(event) => setTraceId(event.target.value)}
                style={{ width: 300 }}
              />
              <Button type="primary" onClick={() => loadTrace()} loading={logsLoading}>Load Trace</Button>
            </Space>
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
              title={<Text type="secondary">Total Users</Text>}
              value={adminStats.users ?? adminStats.totalUsers ?? 0}
              styles={{ content: { color: '#F37021', fontWeight: 700 } }}
              prefix={<Users size={20} />}
            />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card hoverable className="glass-card" style={{ borderLeft: '3px solid #52c41a' }}>
            <Statistic
              title={<Text type="secondary">Mentors</Text>}
              value={adminStats.mentors ?? 0}
              styles={{ content: { color: '#52c41a', fontWeight: 700 } }}
              prefix={<GraduationCap size={20} />}
            />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card hoverable className="glass-card" style={{ borderLeft: '3px solid #F37021' }}>
            <Statistic
              title={<Text type="secondary">Courses</Text>}
              value={adminStats.courses ?? adminStats.totalCourses ?? 0}
              styles={{ content: { color: '#F37021', fontWeight: 700 } }}
              prefix={<Library size={20} />}
            />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card hoverable className="glass-card" style={{ borderLeft: '3px solid #fa8c16' }}>
            <Statistic
              title={<Text type="secondary">Support Requests</Text>}
              value={adminStats.escalations ?? 0}
              styles={{ content: { color: '#fa8c16', fontWeight: 700 } }}
              prefix={<AlertTriangle size={20} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={<><BarChart3 size={16} style={{ verticalAlign: 'text-bottom', marginRight: 8 }} />Weekly Query Activity</>}
            hoverable
          >
            <div style={{ display: 'flex', flexDirection: 'column', height: 200, justifyContent: 'flex-end', alignItems: 'center' }}>
              <Text type="secondary">Chart is being updated...</Text>
              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 20px' }}>
                <Text>Mon</Text><Text>Tue</Text><Text>Wed</Text>
                <Text>Thu</Text><Text>Fri</Text><Text>Sat</Text><Text>Sun</Text>
              </div>
            </div>
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

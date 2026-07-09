import React from 'react';
import { Row, Col, Card, Statistic, Space, Alert, Button, Typography, Tag, Tabs, Table, Input } from 'antd';
import {
  BarChart3, Users, GraduationCap, Zap, AlertTriangle, RefreshCw, Server, FileText
} from 'lucide-react';
import { apiService } from '../../services/api';
import { env } from '../../config/env';

const { Text, Title } = Typography;
const { TabPane } = Tabs;

function AdminDashboard({ adminStats = {}, diagnosticsOutput, isDiagnosticsRunning, runDiagnostics }) {
  const [logs, setLogs] = React.useState([]);
  const [logsLoading, setLogsLoading] = React.useState(false);
  const [traceId, setTraceId] = React.useState('');
  const [traceOutput, setTraceOutput] = React.useState(null);

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await apiService.getHarnessLogs({ limit: 50 });
      setLogs(Array.isArray(data) ? data : data?.content || data?.logs || []);
    } catch (e) {
      // Backend might not have this endpoint yet, ignore quietly
      setLogs([{ id: '1', level: 'INFO', message: 'Log service unavailable or endpoint missing.' }]);
    } finally {
      setLogsLoading(false);
    }
  };

  const loadTrace = async () => {
    if (!traceId) return;
    setLogsLoading(true);
    try {
      const data = await apiService.getTraceLogs(traceId);
      setTraceOutput(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLogsLoading(false);
    }
  };

  React.useEffect(() => {
    loadLogs();
  }, []);

  const harnessLabel = env.n8nEnabled ? 'n8n harness enabled' : 'Backend direct';
  const harnessColor = env.n8nEnabled ? 'processing' : 'default';

  return (
    <div className="portal-view">
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} lg={6}>
          <Card hoverable className="glass-card" style={{ borderLeft: '3px solid #F37021' }}>
            <Statistic
              title={<Text type="secondary">Total Users</Text>}
              value={adminStats.users ?? adminStats.totalUsers ?? 0}
              valueStyle={{ color: '#F37021', fontWeight: 700 }}
              prefix={<Users size={20} />}
            />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card hoverable className="glass-card" style={{ borderLeft: '3px solid #52c41a' }}>
            <Statistic
              title={<Text type="secondary">Mentors</Text>}
              value={adminStats.mentors ?? 0}
              valueStyle={{ color: '#52c41a', fontWeight: 700 }}
              prefix={<GraduationCap size={20} />}
            />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card hoverable className="glass-card" style={{ borderLeft: '3px solid #F37021' }}>
            <Statistic
              title={<Text type="secondary">Subscriptions</Text>}
              value={adminStats.subscriptions ?? 0}
              valueStyle={{ color: '#F37021', fontWeight: 700 }}
              prefix={<Zap size={20} />}
            />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card hoverable className="glass-card" style={{ borderLeft: '3px solid #fa8c16' }}>
            <Statistic
              title={<Text type="secondary">Support Requests</Text>}
              value={adminStats.escalations ?? 0}
              valueStyle={{ color: '#fa8c16', fontWeight: 700 }}
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
          <Tabs defaultActiveKey="health" type="card">
            <TabPane tab={<><Server size={14} style={{ marginRight: 6 }}/>System Health</>} key="health">
              <Card
                title="System Diagnostics"
                extra={
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
                }
                hoverable
              >
                {diagnosticsOutput ? (
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
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
                  <Alert message="Click 'Run Check' to verify AI and database connectivity." type="info" showIcon />
                )}
              </Card>
            </TabPane>
            <TabPane tab={<><FileText size={14} style={{ marginRight: 6 }}/>Harness Logs & Traces</>} key="logs">
              <Card
                title="Harness Logs"
                hoverable
                extra={<Button size="small" onClick={loadLogs} icon={<RefreshCw size={14} />}>Reload</Button>}
                style={{ marginBottom: 16 }}
              >
                <Table
                  dataSource={logs}
                  rowKey={(record) => record.id || record.timestamp || Math.random()}
                  size="small"
                  loading={logsLoading}
                  pagination={{ pageSize: 5 }}
                  columns={[
                    { title: 'Time', dataIndex: 'timestamp', key: 'time', render: v => v ? new Date(v).toLocaleString() : '—' },
                    { title: 'Level', dataIndex: 'level', key: 'level', render: v => <Tag color={v === 'ERROR' ? 'red' : v === 'WARN' ? 'orange' : 'blue'}>{v}</Tag> },
                    { title: 'Message', dataIndex: 'message', key: 'msg', ellipsis: true },
                    { title: 'Trace ID', dataIndex: 'traceId', key: 'traceId', render: v => v ? <a onClick={() => { setTraceId(v); loadTrace(); }}>{v}</a> : '—' }
                  ]}
                />
              </Card>
              <Card title="View Memory Trace" hoverable>
                <Space style={{ width: '100%', marginBottom: 16 }}>
                  <Input 
                    placeholder="Enter Trace ID" 
                    value={traceId} 
                    onChange={e => setTraceId(e.target.value)} 
                    style={{ width: 300 }}
                  />
                  <Button type="primary" onClick={loadTrace} loading={logsLoading}>Load Trace</Button>
                </Space>
                {traceOutput && (
                  <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, maxHeight: 300, overflow: 'auto', fontSize: 12 }}>
                    {JSON.stringify(traceOutput, null, 2)}
                  </pre>
                )}
              </Card>
            </TabPane>
          </Tabs>
        </Col>
      </Row>
    </div>
  );
}

export default AdminDashboard;

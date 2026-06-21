import React from 'react';
import { Row, Col, Card, Statistic, Space, Alert, Button, Typography, Tag } from 'antd';
import {
  BarChart3, Users, GraduationCap, Zap, AlertTriangle, RefreshCw
} from 'lucide-react';

const { Text } = Typography;

function AdminDashboard({ adminStats = {}, diagnosticsOutput, isDiagnosticsRunning, runDiagnostics }) {
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
          <Card
            title="System Diagnostics"
            extra={
              <Button
                type="primary"
                icon={<RefreshCw size={14} className={isDiagnosticsRunning ? 'spinning' : ''} />}
                onClick={runDiagnostics}
                loading={isDiagnosticsRunning}
              >
                Run Check
              </Button>
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
        </Col>
      </Row>
    </div>
  );
}

export default AdminDashboard;

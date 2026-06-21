import React, { useState, useEffect } from 'react';
import { Button, Card, Col, Empty, List, Row, Space, Spin, Tag, Typography, Progress, Modal, Input } from 'antd';
import { 
  CheckCircleOutlined, 
  InfoCircleOutlined, 
  ReloadOutlined, 
  ThunderboltOutlined,
  BookOutlined,
  FileTextOutlined,
  CloseCircleOutlined,
  RiseOutlined
} from '@ant-design/icons';
import CanvasGraph from '../../components/CanvasGraph';
import PageHeader from '../../components/common/PageHeader';
import { uiCopy } from '../../constants/uiCopy';

const { Title, Text } = Typography;

const getStatMetadata = (key) => {
  switch (key) {
    case 'activeCourses':
      return {
        label: 'Active Courses',
        icon: <BookOutlined style={{ fontSize: 28, color: '#F37021' }} />,
        color: '#F37021',
        gradient: 'linear-gradient(135deg, rgba(243, 112, 33, 0.08) 0%, rgba(243, 112, 33, 0.01) 100%)',
        border: '1px solid rgba(243, 112, 33, 0.2)'
      };
    case 'totalAssignments':
      return {
        label: 'Total Assignments',
        icon: <FileTextOutlined style={{ fontSize: 28, color: '#3B82F6' }} />,
        color: '#3B82F6',
        gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.01) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.2)'
      };
    case 'submittedTasks':
      return {
        label: 'Submitted Tasks',
        icon: <CheckCircleOutlined style={{ fontSize: 28, color: '#10B981' }} />,
        color: '#10B981',
        gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.01) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.2)'
      };
    case 'supportRequests':
      return {
        label: 'Support Requests',
        icon: <InfoCircleOutlined style={{ fontSize: 28, color: '#EC4899' }} />,
        color: '#EC4899',
        gradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(236, 72, 153, 0.01) 100%)',
        border: '1px solid rgba(236, 72, 153, 0.2)'
      };
    default:
      return {
        label: key.replace(/([A-Z])/g, ' $1'),
        icon: <ThunderboltOutlined style={{ fontSize: 28, color: '#8B5CF6' }} />,
        color: '#8B5CF6',
        gradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.01) 100%)',
        border: '1px solid rgba(139, 92, 246, 0.2)'
      };
  }
};

function LearningProgress({
  learnedTopics,
  weakTopics,
  suggestions,
  isSuggesting,
  refreshSuggestions,
  isLoading = false,
  dashboardStats = {},
  onRefreshDashboard,
  onUpdateMemory,
}) {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [newLearnedText, setNewLearnedText] = useState(learnedTopics ? learnedTopics.join(', ') : '');
  const [newWeakText, setNewWeakText] = useState(weakTopics ? weakTopics.join(', ') : '');

  useEffect(() => {
    setNewLearnedText(learnedTopics ? learnedTopics.join(', ') : '');
  }, [learnedTopics]);

  useEffect(() => {
    setNewWeakText(weakTopics ? weakTopics.join(', ') : '');
  }, [weakTopics]);

  if (isLoading) {
    return (
      <div className="portal-section center-state">
        <Spin size="large" tip="Loading learning dashboard..." />
      </div>
    );
  }

  const statEntries = Object.entries(dashboardStats).filter(([, v]) => v != null && v !== '');
  const totalTopics = (learnedTopics?.length || 0) + (weakTopics?.length || 0);
  const masteryRate = totalTopics > 0 ? Math.round(((learnedTopics?.length || 0) / totalTopics) * 100) : 0;

  return (
    <div className="portal-section" style={{ gap: 20 }}>
      <PageHeader
        title={uiCopy.student.progress.title}
        description={uiCopy.student.progress.subtitle}
        actions={onRefreshDashboard ? (
          <Button type="primary" icon={<ReloadOutlined />} onClick={onRefreshDashboard}>Refresh dashboard</Button>
        ) : null}
      />

      {/* Stats row */}
      {statEntries.length > 0 && (
        <Row gutter={[16, 16]}>
          {statEntries.map(([key, value]) => {
            const meta = getStatMetadata(key);
            return (
              <Col xs={12} sm={6} key={key}>
                <Card 
                  size="small"
                  style={{ 
                    background: meta.gradient, 
                    border: meta.border,
                    borderRadius: 12,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px' }}>
                    <div>
                      <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, display: 'block', textTransform: 'capitalize' }}>
                        {meta.label}
                      </Text>
                      <Title level={3} style={{ margin: '4px 0 0', fontWeight: 800 }}>
                        {String(value)}
                      </Title>
                    </div>
                    <div>{meta.icon}</div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Network Graph + Circular Progress */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card 
            title={
              <Space>
                <RiseOutlined style={{ color: '#F37021' }} />
                <span>{uiCopy.student.progress.networkTitle}</span>
              </Space>
            }
            style={{ borderRadius: 12 }}
          >
            <div className="knowledge-network-frame" style={{ borderRadius: 8 }}>
              <CanvasGraph />
            </div>
          </Card>
        </Col>
        
        <Col xs={24} lg={8}>
          <Card 
            title="Concept Mastery Progress" 
            style={{ height: '100%', borderRadius: 12 }}
          >
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '24px 0 16px',
              height: '100%' 
            }}>
              <Progress 
                type="circle" 
                percent={masteryRate} 
                strokeColor={{ '0%': '#F37021', '100%': '#10B981' }} 
                width={140}
                format={(percent) => (
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: '#1F2937' }}>{percent}%</span>
                    <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>Mastery</span>
                  </div>
                )}
              />
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Title level={5} style={{ margin: 0 }}>Knowledge Score</Title>
                <Text type="secondary" style={{ fontSize: 13, marginTop: 4, display: 'block' }}>
                  You have mastered {learnedTopics?.length || 0} out of {totalTopics} concepts.
                </Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Learned/Weak Topics + AI Action Plan */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card 
            title="Knowledge Profiler"
            extra={
              <Button 
                type="link" 
                size="small" 
                onClick={() => setEditModalVisible(true)}
                style={{ color: '#F37021', fontWeight: 600, padding: 0 }}
              >
                Edit Concepts
              </Button>
            }
            style={{ borderRadius: 12, height: '100%' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <Title level={5} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircleOutlined style={{ color: '#10B981' }} />
                  <span>Mastered Concepts ({learnedTopics?.length || 0})</span>
                </Title>
                <div style={{ 
                  background: 'rgba(16, 185, 129, 0.04)', 
                  border: '1px solid rgba(16, 185, 129, 0.15)',
                  padding: 16, 
                  borderRadius: 10,
                  minHeight: 80 
                }}>
                  {learnedTopics && learnedTopics.length > 0 ? (
                    <Space wrap size={[8, 12]}>
                      {learnedTopics.map((topic) => (
                        <Tag 
                          color="success" 
                          key={topic}
                          style={{ borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 500 }}
                        >
                          ✓ {topic}
                        </Tag>
                      ))}
                    </Space>
                  ) : (
                    <Text type="secondary">No concepts mastered yet. Keep learning!</Text>
                  )}
                </div>
              </div>

              <div>
                <Title level={5} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CloseCircleOutlined style={{ color: '#EF4444' }} />
                  <span>Focus Areas ({weakTopics?.length || 0})</span>
                </Title>
                <div style={{ 
                  background: 'rgba(239, 68, 68, 0.04)', 
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  padding: 16, 
                  borderRadius: 10,
                  minHeight: 80 
                }}>
                  {weakTopics && weakTopics.length > 0 ? (
                    <Space wrap size={[8, 12]}>
                      {weakTopics.map((topic) => (
                        <Tag 
                          color="error" 
                          key={topic}
                          style={{ borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 500 }}
                        >
                          ⚠ {topic}
                        </Tag>
                      ))}
                    </Space>
                  ) : (
                    <Text type="secondary">Awesome! You have no weak concepts currently.</Text>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={uiCopy.student.progress.suggestionsTitle}
            extra={
              <Button 
                icon={<ThunderboltOutlined style={{ color: '#fff' }} />} 
                onClick={refreshSuggestions} 
                loading={isSuggesting}
                style={{
                  background: 'linear-gradient(135deg, #F37021 0%, #FF8F42 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  borderRadius: 20,
                  boxShadow: '0 4px 12px rgba(243, 112, 33, 0.3)',
                  height: 36,
                  padding: '0 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(243, 112, 33, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(243, 112, 33, 0.3)';
                }}
              >
                Analyze again
              </Button>
            }
            style={{ borderRadius: 12, height: '100%' }}
          >
            <List
              dataSource={Array.isArray(suggestions) ? suggestions : []}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No study suggestions yet" /> }}
              renderItem={(suggestion) => {
                const isHigh = suggestion.priority === 'high';
                return (
                  <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12, 
                      width: '100%',
                      background: isHigh ? 'rgba(239, 68, 68, 0.02)' : 'rgba(245, 158, 11, 0.02)',
                      borderLeft: `4px solid ${isHigh ? '#EF4444' : '#F59E0B'}`,
                      padding: 12,
                      borderRadius: '0 8px 8px 0'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#1F2937', marginBottom: 4 }}>
                          {suggestion.title}
                        </div>
                        <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                          {suggestion.content}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, marginTop: 2 }}>
                        <Tag color={isHigh ? 'error' : 'warning'} style={{ fontWeight: 600, margin: 0 }}>
                          {isHigh ? 'HIGH' : 'RECOMMENDED'}
                        </Tag>
                      </div>
                    </div>
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="Edit Knowledge Profiler"
        open={editModalVisible}
        onOk={() => {
          const lList = newLearnedText.split(',').map(s => s.trim()).filter(Boolean);
          const wList = newWeakText.split(',').map(s => s.trim()).filter(Boolean);
          onUpdateMemory?.(lList, wList);
          setEditModalVisible(false);
        }}
        onCancel={() => {
          setEditModalVisible(false);
          setNewLearnedText(learnedTopics ? learnedTopics.join(', ') : '');
          setNewWeakText(weakTopics ? weakTopics.join(', ') : '');
        }}
        okText="Save Profiler"
        cancelText="Cancel"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <div>
            <label style={{ fontWeight: 500, fontSize: 13, display: 'block', marginBottom: 6 }}>
              Mastered Concepts (comma separated):
            </label>
            <Input.TextArea
              rows={3}
              placeholder="e.g. MVC Flow, JPA Repository, SQL Basics"
              value={newLearnedText}
              onChange={(e) => setNewLearnedText(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontWeight: 500, fontSize: 13, display: 'block', marginBottom: 6 }}>
              Focus Areas (comma separated):
            </label>
            <Input.TextArea
              rows={3}
              placeholder="e.g. Spring Security, OAuth2, Docker Deployment"
              value={newWeakText}
              onChange={(e) => setNewWeakText(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default LearningProgress;

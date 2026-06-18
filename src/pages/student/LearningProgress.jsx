import React from 'react';
import { Button, Card, Col, Empty, List, Row, Space, Tag, Typography } from 'antd';
import { CheckCircleOutlined, InfoCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import CanvasGraph from '../../components/CanvasGraph';
import PageHeader from '../../components/common/PageHeader';
import { uiCopy } from '../../constants/uiCopy';

const { Title } = Typography;

function LearningProgress({ learnedTopics, weakTopics, suggestions, isSuggesting, refreshSuggestions }) {
  return (
    <div className="portal-section">
      <PageHeader title={uiCopy.student.progress.title} description={uiCopy.student.progress.subtitle} />
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card title={uiCopy.student.progress.networkTitle}>
            <div className="knowledge-network-frame">
              <CanvasGraph />
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={uiCopy.student.progress.title}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Title level={5}><CheckCircleOutlined style={{ color: '#52c41a' }} /> {uiCopy.student.progress.learnedTitle}</Title>
                <Space wrap>
                  {learnedTopics.map((topic) => <Tag color="success" key={topic}>{topic}</Tag>)}
                </Space>
              </div>
              <div style={{ marginTop: 16 }}>
                <Title level={5}><InfoCircleOutlined style={{ color: '#ff4d4f' }} /> {uiCopy.student.progress.weakTitle}</Title>
                <Space wrap>
                  {weakTopics.map((topic) => <Tag color="error" key={topic}>{topic}</Tag>)}
                </Space>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={uiCopy.student.progress.suggestionsTitle}
            extra={<Button icon={<ThunderboltOutlined />} onClick={refreshSuggestions} loading={isSuggesting}>Analyze again</Button>}
          >
            <List
              dataSource={Array.isArray(suggestions) ? suggestions : []}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No study suggestions yet" /> }}
              renderItem={(suggestion) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Tag color={suggestion.priority === 'high' ? 'red' : 'gold'}>{suggestion.priority === 'high' ? 'High' : 'Med'}</Tag>}
                    title={suggestion.title}
                    description={suggestion.content}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default LearningProgress;

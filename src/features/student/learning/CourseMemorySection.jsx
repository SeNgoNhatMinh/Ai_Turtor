import {
  BulbOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Empty, Tag, Typography } from 'antd';

const { Text } = Typography;

function CourseMemorySection({
  learnedTopics,
  weakTopics,
  memorySummary,
  recentQuestions,
  hasContext,
  onEdit,
}) {
  return (
    <div className="learning-context-grid">
      <Card
        className="learning-card learning-context-card"
        title="Course Memory"
        extra={<Button size="small" onClick={onEdit} disabled={!hasContext}>Edit memory</Button>}
      >
        {memorySummary ? (
          <Alert type="info" showIcon icon={<BulbOutlined />} title="Memory summary" description={memorySummary} />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No memory summary yet. Ask AI Tutor questions or submit quizzes to build course memory." />
        )}
        <div className="learning-memory-grid">
          <div className="learning-topic-section">
            <div className="learning-topic-header">
              <CheckCircleOutlined />
              <Text strong>Learned topics</Text>
              <Tag>{learnedTopics.length}</Tag>
            </div>
            <div className="learning-topic-cloud learning-topic-cloud--learned">
              {learnedTopics.length
                ? learnedTopics.map((topic) => <Tag key={topic}>{topic}</Tag>)
                : <Text type="secondary">No learned topics recorded yet.</Text>}
            </div>
          </div>
          <div className="learning-topic-section">
            <div className="learning-topic-header">
              <CloseCircleOutlined />
              <Text strong>Focus areas</Text>
              <Tag color={weakTopics.length ? 'warning' : 'success'}>{weakTopics.length}</Tag>
            </div>
            <div className="learning-topic-cloud learning-topic-cloud--weak">
              {weakTopics.length
                ? weakTopics.map((topic) => <Tag key={topic}>{topic}</Tag>)
                : <Text type="secondary">No weak concepts currently.</Text>}
            </div>
          </div>
        </div>
      </Card>

      <Card className="learning-card learning-context-card" title="Recent learning signals">
        {recentQuestions.length ? (
          <div className="learning-recent-list">
            {recentQuestions.map((question, index) => (
              <div key={`${question}-${index}`} className="learning-recent-item">
                <HistoryOutlined />
                <span>{question}</span>
              </div>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No recent questions recorded yet" />
        )}
      </Card>
    </div>
  );
}

export default CourseMemorySection;

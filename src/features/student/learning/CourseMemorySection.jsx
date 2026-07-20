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
        title="Bộ nhớ học tập theo môn"
        extra={<Button size="small" onClick={onEdit} disabled={!hasContext}>Chỉnh sửa</Button>}
      >
        {memorySummary ? (
          <Alert type="info" showIcon icon={<BulbOutlined />} title="Tóm tắt quá trình học" description={memorySummary} />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có tóm tắt. Hãy hỏi AI Tutor hoặc hoàn thành quiz để xây dựng bộ nhớ học tập." />
        )}
        <div className="learning-memory-grid">
          <div className="learning-topic-section">
            <div className="learning-topic-header">
              <CheckCircleOutlined />
              <Text strong>Chủ đề đã nắm</Text>
              <Tag>{learnedTopics.length}</Tag>
            </div>
            <div className="learning-topic-cloud learning-topic-cloud--learned">
              {learnedTopics.length
                ? learnedTopics.map((topic) => <Tag key={topic}>{topic}</Tag>)
                : <Text type="secondary">Chưa ghi nhận chủ đề đã nắm.</Text>}
            </div>
          </div>
          <div className="learning-topic-section">
            <div className="learning-topic-header">
              <CloseCircleOutlined />
              <Text strong>Nội dung cần tập trung</Text>
              <Tag color={weakTopics.length ? 'warning' : 'success'}>{weakTopics.length}</Tag>
            </div>
            <div className="learning-topic-cloud learning-topic-cloud--weak">
              {weakTopics.length
                ? weakTopics.map((topic) => <Tag key={topic}>{topic}</Tag>)
                : <Text type="secondary">Hiện chưa có chủ đề yếu.</Text>}
            </div>
          </div>
        </div>
      </Card>

      <Card className="learning-card learning-context-card" title="Hoạt động học gần đây">
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
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa ghi nhận câu hỏi gần đây" />
        )}
      </Card>
    </div>
  );
}

export default CourseMemorySection;

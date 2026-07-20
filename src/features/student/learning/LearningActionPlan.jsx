import { useMemo } from 'react';
import {
  CheckCircleOutlined,
  PlayCircleOutlined,
  PushpinOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { Button, Card, Empty, Space, Tag, Typography } from 'antd';
import { buildLearningActionPlan } from './buildLearningActionPlan';

const { Text, Title } = Typography;

function FocusActions({ item, canStudy, canCreateQuiz, onStudy, onCreateQuiz, compact = false }) {
  return (
    <Space size={6} wrap>
      <Button
        size={compact ? 'small' : 'middle'}
        type={compact ? 'text' : 'primary'}
        icon={<PlayCircleOutlined />}
        disabled={!canStudy}
        onClick={() => onStudy?.(item.title)}
      >
        Học
      </Button>
      <Button
        size={compact ? 'small' : 'middle'}
        type="text"
        icon={<QuestionCircleOutlined />}
        disabled={!canCreateQuiz}
        onClick={() => onCreateQuiz?.(item.title)}
      >
        Quiz
      </Button>
    </Space>
  );
}

function LearningActionPlan({
  courseId,
  learnedTopics,
  weakTopics,
  suggestions,
  hasContext,
  onStudy,
  onCreateQuiz,
  consumedSuggestionKeys = [],
}) {
  const plan = useMemo(() => buildLearningActionPlan({
    learnedTopics,
    weakTopics,
    suggestions,
    consumedSuggestionKeys,
  }), [consumedSuggestionKeys, learnedTopics, suggestions, weakTopics]);
  const [primaryItem, ...remainingItems] = plan.focusItems;
  const canStudy = Boolean(hasContext && onStudy);
  const canCreateQuiz = Boolean(hasContext && onCreateQuiz);

  return (
    <Card
      className="learning-card learning-action-plan-card"
      title="Kế hoạch học theo môn"
      extra={courseId ? <Tag>{courseId}</Tag> : null}
    >
      <div className="learning-action-metrics" aria-label="Tóm tắt kế hoạch học theo môn">
        <div><strong>{plan.counts.focus}</strong><span>Nội dung ưu tiên</span></div>
        <div><strong>{plan.counts.weak}</strong><span>Chủ đề còn yếu</span></div>
        <div><strong>{plan.counts.mastered}</strong><span>Đã nắm vững</span></div>
      </div>

      {primaryItem ? (
        <>
          <section className="learning-primary-action" aria-labelledby="learning-next-step-title">
            <div className="learning-card-kicker">Bước tiếp theo được đề xuất</div>
            <div className="learning-primary-action-row">
              <div className="learning-primary-action-copy">
                <div className="learning-action-tags">
                  <Tag color={primaryItem.status === 'weak' ? 'warning' : 'processing'}>
                    {primaryItem.status === 'weak' ? 'Cần ôn lại' : 'Nên học'}
                  </Tag>
                  {primaryItem.pinned && <Tag icon={<PushpinOutlined />}>Đã ghim</Tag>}
                </div>
                <Title id="learning-next-step-title" level={4}>{primaryItem.title}</Title>
                <Text>{primaryItem.description}</Text>
              </div>
              <FocusActions
                item={primaryItem}
                canStudy={canStudy}
                canCreateQuiz={canCreateQuiz}
                onStudy={onStudy}
                onCreateQuiz={onCreateQuiz}
              />
            </div>
          </section>

          {remainingItems.length > 0 && (
            <section className="learning-priority-queue" aria-labelledby="learning-priority-queue-title">
              <div className="learning-section-heading">
                <div>
                  <Text strong id="learning-priority-queue-title">Tiếp theo</Text>
                  <Text type="secondary">Học lần lượt theo thứ tự ưu tiên bên dưới.</Text>
                </div>
              </div>
              <ol>
                {remainingItems.map((item, index) => (
                  <li key={item.id}>
                    <span className="learning-priority-number">{index + 2}</span>
                    <div className="learning-priority-copy">
                      <Text strong>{item.title}</Text>
                      <Text type="secondary">{item.status === 'weak' ? 'Nội dung trọng tâm' : 'Bài luyện tập đề xuất'}</Text>
                    </div>
                    <FocusActions
                      compact
                      item={item}
                      canStudy={canStudy}
                      canCreateQuiz={canCreateQuiz}
                      onStudy={onStudy}
                      onCreateQuiz={onCreateQuiz}
                    />
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={plan.counts.mastered
            ? 'Hiện không có nội dung cần ưu tiên. Hãy phân tích lại sau lần chat hoặc quiz tiếp theo.'
            : 'Chưa có hành động học tập. Hãy hỏi AI Tutor hoặc hoàn thành quiz để xây dựng kế hoạch.'}
        />
      )}

      {plan.masteredTopics.length > 0 && (
        <section className="learning-mastered-strip" aria-labelledby="learning-mastered-title">
          <div className="learning-section-heading learning-section-heading--inline">
            <CheckCircleOutlined />
            <Text strong id="learning-mastered-title">Kiến thức nền đã nắm vững</Text>
          </div>
          <div className="learning-mastered-topics">
            {plan.masteredTopics.slice(0, 8).map((topic) => <Tag key={topic}>{topic}</Tag>)}
            {plan.masteredTopics.length > 8 && <Tag>+{plan.masteredTopics.length - 8} nội dung</Tag>}
          </div>
        </section>
      )}
    </Card>
  );
}

export default LearningActionPlan;

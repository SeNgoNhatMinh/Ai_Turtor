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
        Study
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
}) {
  const plan = useMemo(() => buildLearningActionPlan({
    learnedTopics,
    weakTopics,
    suggestions,
  }), [learnedTopics, suggestions, weakTopics]);
  const [primaryItem, ...remainingItems] = plan.focusItems;
  const canStudy = Boolean(hasContext && onStudy);
  const canCreateQuiz = Boolean(hasContext && onCreateQuiz);

  return (
    <Card
      className="learning-card learning-action-plan-card"
      title="Course Action Plan"
      extra={courseId ? <Tag>{courseId}</Tag> : null}
    >
      <div className="learning-action-metrics" aria-label="Course action plan summary">
        <div><strong>{plan.counts.focus}</strong><span>Focus items</span></div>
        <div><strong>{plan.counts.weak}</strong><span>Weak topics</span></div>
        <div><strong>{plan.counts.mastered}</strong><span>Mastered</span></div>
      </div>

      {primaryItem ? (
        <>
          <section className="learning-primary-action" aria-labelledby="learning-next-step-title">
            <div className="learning-card-kicker">Recommended next step</div>
            <div className="learning-primary-action-row">
              <div className="learning-primary-action-copy">
                <div className="learning-action-tags">
                  <Tag color={primaryItem.status === 'weak' ? 'warning' : 'processing'}>
                    {primaryItem.status === 'weak' ? 'Needs review' : 'Recommended'}
                  </Tag>
                  {primaryItem.pinned && <Tag icon={<PushpinOutlined />}>Pinned</Tag>}
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
                  <Text strong id="learning-priority-queue-title">Up next</Text>
                  <Text type="secondary">Work through this queue in the order shown.</Text>
                </div>
              </div>
              <ol>
                {remainingItems.map((item, index) => (
                  <li key={item.id}>
                    <span className="learning-priority-number">{index + 2}</span>
                    <div className="learning-priority-copy">
                      <Text strong>{item.title}</Text>
                      <Text type="secondary">{item.status === 'weak' ? 'Focus area' : 'Recommended practice'}</Text>
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
            ? 'No current focus items. Analyze memory after your next chat or quiz to refresh recommendations.'
            : 'No learning actions yet. Ask AI Tutor questions or complete a quiz to build your course plan.'}
        />
      )}

      {plan.masteredTopics.length > 0 && (
        <section className="learning-mastered-strip" aria-labelledby="learning-mastered-title">
          <div className="learning-section-heading learning-section-heading--inline">
            <CheckCircleOutlined />
            <Text strong id="learning-mastered-title">Mastered foundation</Text>
          </div>
          <div className="learning-mastered-topics">
            {plan.masteredTopics.slice(0, 8).map((topic) => <Tag key={topic}>{topic}</Tag>)}
            {plan.masteredTopics.length > 8 && <Tag>+{plan.masteredTopics.length - 8} more</Tag>}
          </div>
        </section>
      )}
    </Card>
  );
}

export default LearningActionPlan;

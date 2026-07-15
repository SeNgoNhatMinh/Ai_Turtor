import { CheckCircleOutlined, CloseCircleOutlined, PushpinOutlined } from '@ant-design/icons';
import { Card, Empty, Progress, Tag, Typography } from 'antd';

const { Text, Title } = Typography;

function LearningOverview({
  courseId,
  classId,
  formattedMemoryTime,
  masteryRate,
  masteryStatus,
  topFocusItems,
  pinnedSuggestions,
  onUnpinSuggestion,
  learnedCount,
  weakCount,
  statEntries,
}) {
  return (
    <>
      <div className="learning-hero-grid">
        <Card className="learning-card learning-card--hero">
          <div className="learning-card-kicker">Learning Snapshot</div>
          <div className="learning-hero-content">
            <div>
              <Title level={3} className="learning-card-title">Course learning state</Title>
              <Text className="learning-card-description">
                This snapshot combines course memory, weak topics, submitted work, support history, and quiz results.
              </Text>
              <div className="learning-scope-row">
                {courseId && <Tag>Course: {courseId}</Tag>}
                {classId && <Tag>Class: {classId}</Tag>}
                {formattedMemoryTime && <Tag>Updated: {formattedMemoryTime}</Tag>}
              </div>
            </div>
            <div className="learning-progress-ring">
              <Progress
                type="circle"
                percent={masteryRate}
                width={132}
                strokeColor={masteryRate >= 75 ? '#16A34A' : masteryRate >= 45 ? '#F59E0B' : '#EF4444'}
                format={(percent) => <span className="learning-progress-value">{percent}%</span>}
              />
              <Tag color={masteryStatus.tone} className="learning-status-tag">{masteryStatus.label}</Tag>
            </div>
          </div>
        </Card>

        <Card className="learning-card learning-card--focus">
          <div className="learning-card-kicker">Next best focus</div>
          <Title level={4} className="learning-card-title">Review queue</Title>
          {topFocusItems.length ? (
            <div className="learning-focus-list">
              {topFocusItems.map((item) => {
                const isPinned = pinnedSuggestions.includes(item);
                return (
                  <Tag
                    key={item}
                    className="learning-focus-chip"
                    closable={isPinned && Boolean(onUnpinSuggestion)}
                    onClose={(event) => {
                      event.preventDefault();
                      onUnpinSuggestion?.(item);
                    }}
                  >
                    {isPinned && <PushpinOutlined />}
                    {item}
                  </Tag>
                );
              })}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No focus items yet" />
          )}
        </Card>
      </div>

      <div className="learning-stat-grid">
        <Card className="learning-card learning-stat-card">
          <div className="learning-stat-icon"><CheckCircleOutlined /></div>
          <div>
            <div className="learning-stat-label">Learned topics</div>
            <div className="learning-stat-value">{learnedCount}</div>
            <div className="learning-stat-description">Topics marked as understood</div>
          </div>
        </Card>
        <Card className="learning-card learning-stat-card">
          <div className="learning-stat-icon"><CloseCircleOutlined /></div>
          <div>
            <div className="learning-stat-label">Weak topics</div>
            <div className="learning-stat-value">{weakCount}</div>
            <div className="learning-stat-description">Focus areas from memory and quizzes</div>
          </div>
        </Card>
        {statEntries.map((stat) => (
          <Card key={stat.key} className="learning-card learning-stat-card">
            <div className="learning-stat-icon">{stat.icon}</div>
            <div>
              <div className="learning-stat-label">{stat.label}</div>
              <div className="learning-stat-value">{String(stat.value)}</div>
              <div className="learning-stat-description">{stat.description}</div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

export default LearningOverview;

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
          <div className="learning-card-kicker">Tổng quan học tập</div>
          <div className="learning-hero-content">
            <div>
              <Title level={3} className="learning-card-title">Trạng thái học theo môn</Title>
              <Text className="learning-card-description">
                Tổng hợp từ lịch sử hỏi AI, chủ đề còn yếu, bài đã nộp, yêu cầu hỗ trợ và kết quả quiz.
              </Text>
              <div className="learning-scope-row">
                {courseId && <Tag>Môn: {courseId}</Tag>}
                {classId && <Tag>Lớp: {classId}</Tag>}
                {formattedMemoryTime && <Tag>Cập nhật: {formattedMemoryTime}</Tag>}
              </div>
            </div>
            <div className="learning-progress-ring">
              <Progress
                type="circle"
                percent={masteryRate}
                size={132}
                strokeColor={masteryRate >= 75 ? '#16A34A' : masteryRate >= 45 ? '#F59E0B' : '#EF4444'}
                format={(percent) => <span className="learning-progress-value">{percent}%</span>}
              />
              <Tag color={masteryStatus.tone} className="learning-status-tag">{masteryStatus.label}</Tag>
            </div>
          </div>
        </Card>

        <Card className="learning-card learning-card--focus">
          <div className="learning-card-kicker">Ưu tiên tiếp theo</div>
          <Title level={4} className="learning-card-title">Nội dung cần ôn</Title>
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
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có nội dung cần ưu tiên" />
          )}
        </Card>
      </div>

      <div className="learning-stat-grid">
        <Card className="learning-card learning-stat-card">
          <div className="learning-stat-icon"><CheckCircleOutlined /></div>
          <div>
            <div className="learning-stat-label">Chủ đề đã nắm</div>
            <div className="learning-stat-value">{learnedCount}</div>
            <div className="learning-stat-description">Nội dung đã được ghi nhận là hiểu</div>
          </div>
        </Card>
        <Card className="learning-card learning-stat-card">
          <div className="learning-stat-icon"><CloseCircleOutlined /></div>
          <div>
            <div className="learning-stat-label">Chủ đề còn yếu</div>
            <div className="learning-stat-value">{weakCount}</div>
            <div className="learning-stat-description">Tổng hợp từ bộ nhớ và kết quả quiz</div>
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

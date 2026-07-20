import {
  PlayCircleOutlined,
  PushpinOutlined,
  QuestionCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Button, Card, Empty, Skeleton, Space, Tag, Tooltip, Typography } from 'antd';
import { getSuggestionText, normalizeSuggestionKey } from './learningProgressUtils';

const { Text } = Typography;

function StudySuggestionsSection({
  suggestions,
  pinnedSet,
  hasContext,
  isSuggesting,
  onAnalyze,
  onStudy,
  onCreateQuiz,
  onPin,
  onUnpin,
  consumedSet = new Set(),
}) {
  return (
    <Card
      className="learning-card learning-plan-card"
      title="Gợi ý học tập"
      extra={(
        <Button icon={<ThunderboltOutlined />} onClick={onAnalyze} loading={isSuggesting} disabled={!hasContext}>
          Phân tích lại
        </Button>
      )}
    >
      {isSuggesting ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : suggestions.length ? (
        <div className="learning-suggestion-list">
          {suggestions.map((suggestion) => {
            const isHigh = suggestion.priority === 'high';
            const suggestionText = getSuggestionText(suggestion);
            const isPinned = pinnedSet.has(normalizeSuggestionKey(suggestionText));
            const isConsumed = consumedSet.has(normalizeSuggestionKey(suggestionText))
              || suggestion.consumed === true
              || suggestion.used === true
              || suggestion.suggestionConsumed === true;
            const canStudy = Boolean(hasContext && onStudy && !isConsumed);
            const openSuggestion = () => canStudy && onStudy(suggestionText);

            return (
              <div key={normalizeSuggestionKey(suggestionText) || suggestion.title} className={`learning-suggestion-item ${isPinned ? 'learning-suggestion-item--pinned' : ''}`}>
                <div
                  className={`learning-suggestion-copy ${canStudy ? 'learning-suggestion-copy--clickable' : ''}`}
                  role={canStudy ? 'button' : undefined}
                  tabIndex={canStudy ? 0 : undefined}
                  onClick={openSuggestion}
                  onKeyDown={(event) => {
                    if (canStudy && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      openSuggestion();
                    }
                  }}
                  aria-label={canStudy ? `Học nội dung gợi ý: ${suggestionText}` : undefined}
                >
                  <Tag color={isPinned ? 'orange' : isHigh ? 'error' : 'default'}>
                    {isConsumed ? 'Đã học' : isPinned ? 'Đã ghim' : isHigh ? 'Ưu tiên cao' : 'Nên học'}
                  </Tag>
                  <Text strong>{suggestion.title || 'Gợi ý học tập'}</Text>
                  <Text type="secondary">{suggestion.content || 'Luyện tập và ôn lại nội dung này.'}</Text>
                </div>
                <Space className="learning-suggestion-actions" size={8} wrap>
                  <Tooltip title="Mở nội dung này trong AI Tutor Chat">
                    <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => onStudy?.(suggestionText)} disabled={!canStudy}>
                      {isConsumed ? 'Đã học' : 'Học ngay'}
                    </Button>
                  </Tooltip>
                  <Tooltip title="Tạo quiz tự ôn từ tài liệu môn học đã lập chỉ mục">
                    <Button size="small" icon={<QuestionCircleOutlined />} onClick={() => onCreateQuiz?.(suggestionText)} disabled={!hasContext || !onCreateQuiz}>
                      Tạo quiz
                    </Button>
                  </Tooltip>
                  <Button
                    size="small"
                    type={isPinned ? 'default' : 'text'}
                    icon={<PushpinOutlined />}
                    disabled={!hasContext || (!onPin && !onUnpin)}
                    onClick={() => (isPinned ? onUnpin?.(suggestionText) : onPin?.(suggestionText))}
                  >
                    {isPinned ? 'Bỏ ghim' : 'Ghim'}
                  </Button>
                </Space>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có gợi ý. Hãy phân tích tiến độ để tạo bước học tiếp theo." />
      )}
    </Card>
  );
}

export default StudySuggestionsSection;

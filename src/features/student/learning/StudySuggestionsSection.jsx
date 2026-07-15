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
}) {
  return (
    <Card
      className="learning-card learning-plan-card"
      title="Study Suggestions"
      extra={(
        <Button icon={<ThunderboltOutlined />} onClick={onAnalyze} loading={isSuggesting} disabled={!hasContext}>
          Analyze again
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
            const canStudy = Boolean(hasContext && onStudy);
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
                  aria-label={canStudy ? `Study suggestion: ${suggestionText}` : undefined}
                >
                  <Tag color={isPinned ? 'orange' : isHigh ? 'error' : 'default'}>
                    {isPinned ? 'Pinned' : isHigh ? 'High priority' : 'Recommended'}
                  </Tag>
                  <Text strong>{suggestion.title || 'Study suggestion'}</Text>
                  <Text type="secondary">{suggestion.content || 'Practice and review this topic.'}</Text>
                </div>
                <Space className="learning-suggestion-actions" size={8} wrap>
                  <Tooltip title="Open this topic in AI Tutor Chat">
                    <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => onStudy?.(suggestionText)} disabled={!hasContext || !onStudy}>
                      Study now
                    </Button>
                  </Tooltip>
                  <Tooltip title="Create a self-study quiz from indexed course materials">
                    <Button size="small" icon={<QuestionCircleOutlined />} onClick={() => onCreateQuiz?.(suggestionText)} disabled={!hasContext || !onCreateQuiz}>
                      Create quiz
                    </Button>
                  </Tooltip>
                  <Button
                    size="small"
                    type={isPinned ? 'default' : 'text'}
                    icon={<PushpinOutlined />}
                    disabled={!hasContext || (!onPin && !onUnpin)}
                    onClick={() => (isPinned ? onUnpin?.(suggestionText) : onPin?.(suggestionText))}
                  >
                    {isPinned ? 'Unpin' : 'Pin'}
                  </Button>
                </Space>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No study suggestions yet. Analyze memory to generate next steps." />
      )}
    </Card>
  );
}

export default StudySuggestionsSection;

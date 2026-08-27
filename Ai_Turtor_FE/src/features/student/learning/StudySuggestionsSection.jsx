import {
  PlayCircleOutlined,
  PushpinOutlined,
  QuestionCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { Alert, Button, Card, Empty, Skeleton, Space, Tag, Tooltip, Typography } from 'antd';
import { confirmDanger } from '../../../components/common/confirmDialog';
import SuggestionDetailModal from './SuggestionDetailModal';
import {
  canDeleteSuggestion,
  formatStudySuggestion,
  getSuggestionText,
  isLongStudySuggestion,
  normalizeSuggestionKey,
} from './learningProgressUtils';

const { Paragraph, Text } = Typography;

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
  onDelete,
  consumedSet = new Set(),
}) {
  const [detailSuggestion, setDetailSuggestion] = useState(null);

  const closeDetail = () => setDetailSuggestion(null);
  const runDetailAction = (action) => {
    action?.(detailSuggestion?.suggestionText);
    closeDetail();
  };

  return (
    <>
      <Card
        className="learning-card learning-plan-card"
        title={(
          <div className="learning-section-title">
            <span>Nội dung nên học tiếp</span>
            <small>Chọn một nội dung để học với AI Tutor hoặc tạo quiz tự ôn.</small>
          </div>
        )}
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
              if (suggestion?.kind === 'note') {
                return (
                  <Alert
                    key={`note-${normalizeSuggestionKey(suggestion.content)}`}
                    className="learning-suggestion-note"
                    type="info"
                    showIcon
                    title={suggestion.title || 'Lưu ý từ AI Tutor'}
                    description={suggestion.content}
                  />
                );
              }

              const isHigh = suggestion.priority === 'high';
              const suggestionText = getSuggestionText(suggestion);
              const display = formatStudySuggestion(suggestion);
              const isLong = isLongStudySuggestion(display);
              const isPinned = pinnedSet.has(normalizeSuggestionKey(suggestionText));
              const isConsumed = consumedSet.has(normalizeSuggestionKey(suggestionText))
                || suggestion.consumed === true
                || suggestion.used === true
                || suggestion.suggestionConsumed === true;
              const canStudy = Boolean(hasContext && onStudy && !isConsumed);
              const canCreateQuiz = Boolean(hasContext && onCreateQuiz);
              const statusLabel = isConsumed ? 'Đã học' : isPinned ? 'Đã ghim' : isHigh ? 'Ưu tiên cao' : 'Nên học';
              const statusColor = isPinned ? 'orange' : isHigh ? 'error' : 'default';
              const previewSteps = display.steps.slice(0, 3);

              return (
                <div key={normalizeSuggestionKey(suggestionText) || suggestion.title} className={`learning-suggestion-item ${isPinned ? 'learning-suggestion-item--pinned' : ''}`}>
                  <div className="learning-suggestion-copy">
                    <div className="learning-suggestion-heading">
                      <Tag color={statusColor}>{statusLabel}</Tag>
                      <Text strong className={`learning-suggestion-title ${isLong ? 'learning-suggestion-title--clamped' : ''}`}>{display.title}</Text>
                    </div>
                    {display.summary && (
                      <Paragraph className={`learning-suggestion-summary ${isLong ? 'learning-suggestion-summary--clamped' : ''}`}>{display.summary}</Paragraph>
                    )}
                    {display.steps.length > 0 && (
                      <div className="learning-suggestion-steps">
                        <span>Các bước nên làm</span>
                        <ul>
                          {(isLong ? previewSteps : display.steps).map((step) => <li key={step}>{step}</li>)}
                        </ul>
                        {isLong && display.steps.length > previewSteps.length && (
                          <Text type="secondary" className="learning-suggestion-step-count">
                            +{display.steps.length - previewSteps.length} bước khác
                          </Text>
                        )}
                      </div>
                    )}
                    {!display.summary && display.steps.length === 0 && (
                      <Text type="secondary">Luyện tập và ôn lại nội dung này.</Text>
                    )}
                    {isLong && (
                      <Button
                        type="link"
                        size="small"
                        className="learning-suggestion-more"
                        onClick={() => setDetailSuggestion({
                          display,
                          suggestionText,
                          statusLabel,
                          statusColor,
                          isConsumed,
                          canStudy,
                          canCreateQuiz,
                        })}
                      >
                        Xem đầy đủ
                      </Button>
                    )}
                  </div>
                  <Space className="learning-suggestion-actions" size={8} wrap>
                    <Tooltip title="Mở nội dung này trong AI Tutor Chat">
                      <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => onStudy?.(suggestionText)} disabled={!canStudy}>
                        {isConsumed ? 'Đã học' : 'Học ngay'}
                      </Button>
                    </Tooltip>
                    <Tooltip title="Tạo quiz tự ôn từ tài liệu môn học đã lập chỉ mục">
                      <Button size="small" icon={<QuestionCircleOutlined />} onClick={() => onCreateQuiz?.(suggestionText)} disabled={!canCreateQuiz}>
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
                    {onDelete && canDeleteSuggestion(suggestion) && (
                      <Button
                        size="small"
                        danger
                        onClick={() => confirmDanger({
                          title: 'Xóa gợi ý khỏi bộ nhớ?',
                          content: 'Gợi ý sẽ bị xóa khỏi bộ nhớ học tập của bạn và không xuất hiện trong danh sách ghim.',
                          okText: 'Xóa',
                          cancelText: 'Hủy',
                          onOk: () => onDelete?.(suggestion),
                        })}
                      >
                        Xóa
                      </Button>
                    )}
                  </Space>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có gợi ý. Hãy phân tích tiến độ để tạo bước học tiếp theo." />
        )}
      </Card>

      <SuggestionDetailModal
        open={Boolean(detailSuggestion)}
        display={detailSuggestion?.display}
        statusLabel={detailSuggestion?.statusLabel}
        statusColor={detailSuggestion?.statusColor}
        isConsumed={detailSuggestion?.isConsumed}
        canStudy={detailSuggestion?.canStudy}
        canCreateQuiz={detailSuggestion?.canCreateQuiz}
        onClose={closeDetail}
        onStudy={() => runDetailAction(onStudy)}
        onCreateQuiz={() => runDetailAction(onCreateQuiz)}
      />
    </>
  );
}

export default StudySuggestionsSection;

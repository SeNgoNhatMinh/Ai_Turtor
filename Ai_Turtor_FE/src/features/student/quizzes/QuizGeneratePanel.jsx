import { memo } from 'react';
import { Alert, Button, Card, Input, InputNumber, Select, Space, Typography } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import {
  MAX_QUIZ_QUESTION_COUNT,
  MIN_QUIZ_QUESTION_COUNT,
  normalizeQuizQuestionCount,
} from './practiceQuizUtils';

const { Text } = Typography;

function QuizGeneratePanel({
  topic,
  setTopic,
  suggestedTopic = '',
  setSuggestedTopic,
  questionCount,
  setQuestionCount,
  suggestionOptions,
  hasContext,
  isLoading,
  isGenerating,
  onGenerate,
}) {
  const selectOptions = suggestionOptions.some((option) => option.value === suggestedTopic)
    ? suggestionOptions
    : suggestedTopic
      ? [{ value: suggestedTopic, label: suggestedTopic }, ...suggestionOptions]
      : suggestionOptions;
  const hasQuizTopic = Boolean(suggestedTopic.trim() || topic.trim());

  return (
    <div className="quiz-generate-layout">
      <Card className="quiz-card quiz-generate-card" title={<span className="quiz-card-title">Tạo quiz tự ôn</span>}>
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            title="Dựa trên tài liệu môn học"
            description="AI Tutor chỉ tạo quiz khi có tài liệu đã lập chỉ mục phù hợp với chủ đề được chọn."
          />
          <div className="quiz-field">
            <label>1. Chọn chủ đề gợi ý</label>
            <Text type="secondary" className="quiz-field-hint">
              Chọn nhanh một chủ đề được đề xuất, hoặc tự nhập ở bước 2.
            </Text>
            <Select
              showSearch
              allowClear
              value={suggestedTopic || undefined}
              onChange={(value) => setSuggestedTopic?.(value || '')}
              optionFilterProp="label"
              placeholder="Chọn chủ đề còn yếu hoặc gợi ý học tập"
              options={selectOptions}
              disabled={!hasContext || isLoading}
            />
          </div>
          <div className="quiz-field">
            <label>2. Nhập hoặc làm rõ chủ đề</label>
            <Text type="secondary" className="quiz-field-hint">
              Bổ sung phạm vi hoặc từ khóa để câu hỏi bám sát nội dung bạn muốn ôn.
            </Text>
            <Input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              allowClear
              maxLength={240}
              placeholder="Ví dụ: constructor Java, cấu hình servlet server..."
              disabled={!hasContext || isLoading}
            />
          </div>
          <div className="quiz-field quiz-field-inline">
            <div>
              <label>3. Chọn số câu hỏi</label>
              <Text type="secondary">Quiz ngắn phù hợp hơn để ôn tập tập trung.</Text>
            </div>
            <InputNumber
              min={MIN_QUIZ_QUESTION_COUNT}
              max={MAX_QUIZ_QUESTION_COUNT}
              precision={0}
              step={1}
              value={questionCount}
              onChange={(value) => setQuestionCount(normalizeQuizQuestionCount(value, questionCount))}
              disabled={!hasContext || isLoading}
            />
          </div>
          <Button
            type="primary"
            size="large"
            block
            icon={<QuestionCircleOutlined />}
            loading={isGenerating}
            disabled={!hasContext || !hasQuizTopic || isLoading}
            onClick={() => onGenerate()}
          >
            Tạo quiz {questionCount} câu
          </Button>
        </Space>
      </Card>

      <Card className="quiz-card quiz-guide-card" title="Quy trình thực hiện">
        <div className="quiz-step-list">
          <div><span>1</span><strong>Chọn chủ đề</strong><small>Dùng chủ đề còn yếu, gợi ý hoặc từ khóa riêng.</small></div>
          <div><span>2</span><strong>AI tạo câu hỏi</strong><small>Đáp án được ẩn trong lúc bạn làm bài.</small></div>
          <div><span>3</span><strong>Nộp và xem lại</strong><small>Kết quả sẽ cập nhật tiến độ học tập sau khi nộp.</small></div>
        </div>
        {suggestionOptions.length > 0 && (
          <div className="quiz-suggestion-strip">
            <Text strong>Chủ đề được đề xuất</Text>
            <div>
              {suggestionOptions.slice(0, 4).map((item) => (
                <button key={item.value} type="button" onClick={() => setSuggestedTopic?.(item.value)}>{item.label}</button>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default memo(QuizGeneratePanel);

import { memo } from 'react';
import { Alert, Button, Card, Input, InputNumber, Select, Space, Typography } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

function QuizGeneratePanel({
  topic,
  setTopic,
  questionCount,
  setQuestionCount,
  suggestionOptions,
  hasContext,
  isLoading,
  isGenerating,
  onGenerate,
}) {
  return (
    <div className="quiz-generate-layout">
      <Card className="quiz-card quiz-generate-card" title={<span className="quiz-card-title">Create a self-study quiz</span>}>
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            title="Grounded in course materials"
            description="AI Tutor only creates a quiz when indexed material is available for the selected topic."
          />
          <div className="quiz-field">
            <label>1. Pick a suggestion or type a topic</label>
            <Select
              showSearch
              allowClear
              value={topic || undefined}
              onChange={(value) => setTopic(value || '')}
              onSearch={setTopic}
              placeholder="Choose a weak topic or suggestion"
              options={suggestionOptions}
              disabled={!hasContext || isLoading}
            />
          </div>
          <div className="quiz-field">
            <label>2. Refine the topic</label>
            <Input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Example: Java constructors, servlet server config..."
              disabled={!hasContext || isLoading}
            />
          </div>
          <div className="quiz-field quiz-field-inline">
            <div>
              <label>3. Choose quiz length</label>
              <Text type="secondary">Short quizzes work best for focused revision.</Text>
            </div>
            <InputNumber
              min={3}
              max={10}
              value={questionCount}
              onChange={(value) => setQuestionCount(value || 5)}
              disabled={!hasContext || isLoading}
            />
          </div>
          <Button
            type="primary"
            size="large"
            block
            icon={<QuestionCircleOutlined />}
            loading={isGenerating}
            disabled={!hasContext || !topic.trim() || isLoading}
            onClick={() => onGenerate()}
          >
            Generate quiz from this topic
          </Button>
        </Space>
      </Card>

      <Card className="quiz-card quiz-guide-card" title="How this flow works">
        <div className="quiz-step-list">
          <div><span>1</span><strong>Choose topic</strong><small>Use a weak topic, suggestion, or custom keyword.</small></div>
          <div><span>2</span><strong>AI generates questions</strong><small>Answers stay hidden while you take the quiz.</small></div>
          <div><span>3</span><strong>Submit and review</strong><small>Score updates your learning progress after submission.</small></div>
        </div>
        {suggestionOptions.length > 0 && (
          <div className="quiz-suggestion-strip">
            <Text strong>Suggested topics</Text>
            <div>
              {suggestionOptions.slice(0, 4).map((item) => (
                <button key={item.value} type="button" onClick={() => setTopic(item.value)}>{item.label}</button>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default memo(QuizGeneratePanel);

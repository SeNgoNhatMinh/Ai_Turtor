import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Space, Typography } from 'antd';

const { Text } = Typography;

const makeQuestion = (question = {}, index = 0) => ({
  questionId: question.questionId || question.id || `q-${index + 1}`,
  type: question.type || 'MULTIPLE_CHOICE',
  questionText: question.questionText || question.text || '',
  options: Array.isArray(question.options) && question.options.length ? question.options : ['', '', '', ''],
  correctAnswer: question.correctAnswer || '',
  explanation: question.explanation || '',
  sourceMaterialIds: question.sourceMaterialIds || [],
});

function QuizDraftEditor({ draft, onSave, saving = false }) {
  const [form] = Form.useForm();
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      form.setFieldsValue({
        title: draft?.title || '',
        topic: draft?.topic || '',
        suggestionText: draft?.suggestionText || '',
      });
      setQuestions((draft?.questions || []).map(makeQuestion));
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [draft, form]);

  const updateQuestion = (index, patch) => {
    setQuestions((current) => current.map((question, idx) => idx === index ? { ...question, ...patch } : question));
  };

  const updateOption = (questionIndex, optionIndex, value) => {
    setQuestions((current) => current.map((question, idx) => {
      if (idx !== questionIndex) return question;
      const options = [...question.options];
      options[optionIndex] = value;
      return { ...question, options };
    }));
  };

  const save = async () => {
    const values = await form.validateFields();
    onSave?.({
      ...values,
      questions: questions.map((question) => ({
        ...question,
        options: question.options.filter(Boolean),
      })),
    });
  };

  if (!draft) return null;

  return (
    <Card className="quiz-card" title="Draft editor">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Quiz title" rules={[{ required: true, message: 'Title is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="topic" label="Topic">
            <Input />
          </Form.Item>
          <Form.Item name="suggestionText" label="Suggestion / learning goal">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>

        {questions.map((question, index) => (
          <div key={question.questionId} className="quiz-question-block">
            <Text strong>Question {index + 1}</Text>
            <Input
              value={question.questionText}
              onChange={(event) => updateQuestion(index, { questionText: event.target.value })}
              placeholder="Question text"
              style={{ marginTop: 8, marginBottom: 8 }}
            />
            <Space direction="vertical" style={{ width: '100%' }}>
              {question.options.map((option, optionIndex) => (
                <Input
                  key={`${question.questionId}-${optionIndex}`}
                  value={option}
                  onChange={(event) => updateOption(index, optionIndex, event.target.value)}
                  placeholder={`Option ${optionIndex + 1}`}
                />
              ))}
            </Space>
            <Input
              value={question.correctAnswer}
              onChange={(event) => updateQuestion(index, { correctAnswer: event.target.value })}
              placeholder="Correct answer"
              style={{ marginTop: 8 }}
            />
            <Input.TextArea
              value={question.explanation}
              onChange={(event) => updateQuestion(index, { explanation: event.target.value })}
              placeholder="Explanation"
              rows={2}
              style={{ marginTop: 8 }}
            />
          </div>
        ))}

        <Button type="primary" loading={saving} onClick={save}>Save draft</Button>
      </Space>
    </Card>
  );
}

export default QuizDraftEditor;

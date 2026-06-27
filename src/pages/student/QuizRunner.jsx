import { useMemo, useState } from 'react';
import { Alert, Button, Card, Radio, Space, Typography } from 'antd';

const { Text, Title } = Typography;

const getSessionId = (quiz) => quiz?.quizSessionId || quiz?.sessionId || quiz?.id;
const getQuestions = (quiz) => Array.isArray(quiz?.questions) ? quiz.questions : [];
const getQuestionId = (question, index) => question?.questionId || question?.id || `question-${index}`;

function QuizRunner({ quiz, onSubmit, submitting = false }) {
  const [answers, setAnswers] = useState({});
  const questions = getQuestions(quiz);
  const quizSessionId = getSessionId(quiz);

  const canSubmit = useMemo(() => {
    return Boolean(quizSessionId && questions.length && questions.every((q, index) => answers[getQuestionId(q, index)]));
  }, [answers, questions, quizSessionId]);

  const submitPayload = () => ({
    answers: questions.map((question, index) => ({
      questionId: getQuestionId(question, index),
      selectedAnswer: answers[getQuestionId(question, index)],
    })),
  });

  if (!quiz) return null;

  return (
    <Card className="quiz-card quiz-runner-card">
      <Space direction="vertical" size={18} style={{ width: '100%' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>{quiz.title || 'Practice quiz'}</Title>
          <Text type="secondary">
            Answers are hidden until you submit. Quiz ID: {quizSessionId || 'new session'}
          </Text>
        </div>

        {!questions.length && (
          <Alert
            type="warning"
            showIcon
            message="No quiz questions returned"
            description="Not enough indexed course material may be available to generate this quiz."
          />
        )}

        {questions.map((question, index) => {
          const questionId = getQuestionId(question, index);
          const options = Array.isArray(question.options) ? question.options : [];
          return (
            <div key={questionId} className="quiz-question-block">
              <Text strong>{index + 1}. {question.questionText || question.text || question.prompt}</Text>
              <Radio.Group
                value={answers[questionId]}
                onChange={(event) => setAnswers((current) => ({ ...current, [questionId]: event.target.value }))}
                className="quiz-options"
              >
                <Space direction="vertical" style={{ width: '100%', marginTop: 10 }}>
                  {options.map((option) => (
                    <Radio key={option} value={option}>{option}</Radio>
                  ))}
                </Space>
              </Radio.Group>
            </div>
          );
        })}

        <Button type="primary" disabled={!canSubmit || submitting} loading={submitting} onClick={() => onSubmit?.(quizSessionId, submitPayload())}>
          Submit quiz
        </Button>
      </Space>
    </Card>
  );
}

export default QuizRunner;

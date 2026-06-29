import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Space, Typography } from 'antd';
import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';
import 'survey-core/survey-core.min.css';

const { Text, Title } = Typography;

const getSessionId = (quiz) => quiz?.quizSessionId || quiz?.sessionId || quiz?.id;
const getQuestions = (quiz) => Array.isArray(quiz?.questions) ? quiz.questions : [];
const getQuestionId = (question, index) => question?.questionId || question?.id || `question-${index}`;
const getQuestionName = (_question, index) => `q_${index + 1}`;

const getQuestionText = (question, index) => (
  question?.questionText
  || question?.text
  || question?.prompt
  || `Question ${index + 1}`
);

const getOptionValue = (option) => {
  if (typeof option === 'string' || typeof option === 'number' || typeof option === 'boolean') {
    return String(option);
  }
  return String(option?.value ?? option?.id ?? option?.text ?? option?.label ?? '');
};

const getOptionLabel = (option) => {
  if (typeof option === 'string' || typeof option === 'number' || typeof option === 'boolean') {
    return String(option);
  }
  return String(option?.text ?? option?.label ?? option?.value ?? option?.id ?? '');
};

const getQuestionChoices = (question) => {
  const rawOptions = Array.isArray(question?.options) && question.options.length
    ? question.options
    : ['TRUE_FALSE', 'BOOLEAN'].includes(String(question?.type || question?.questionType || '').toUpperCase())
      ? ['True', 'False']
      : [];

  return rawOptions
    .map((option) => ({
      value: getOptionValue(option),
      text: getOptionLabel(option),
    }))
    .filter((option) => option.value);
};

const buildSurveyJson = (quiz, questions) => ({
  title: quiz?.title || 'Practice quiz',
  description: 'Answers are hidden until you submit.',
  showQuestionNumbers: 'on',
  showNavigationButtons: false,
  showCompletedPage: false,
  questionErrorLocation: 'bottom',
  pages: [
    {
      name: 'quiz_page',
      elements: questions.map((question, index) => ({
        type: 'radiogroup',
        name: getQuestionName(question, index),
        title: getQuestionText(question, index),
        isRequired: true,
        choices: getQuestionChoices(question),
      })),
    },
  ],
});

function QuizRunner({ quiz, onSubmit, submitting = false }) {
  const [answers, setAnswers] = useState({});
  const questions = getQuestions(quiz);
  const quizSessionId = getSessionId(quiz);
  const surveyJson = useMemo(() => buildSurveyJson(quiz, questions), [quiz, questions]);
  const surveyModel = useMemo(() => {
    const model = new Model(surveyJson);
    model.css = {
      root: 'ai-tutor-survey-root',
    };
    return model;
  }, [surveyJson]);

  useEffect(() => {
    const handleValueChanged = (sender) => {
      setAnswers({ ...sender.data });
    };

    surveyModel.onValueChanged.add(handleValueChanged);
    return () => {
      surveyModel.onValueChanged.remove(handleValueChanged);
    };
  }, [surveyModel]);

  const canSubmit = useMemo(() => {
    return Boolean(quizSessionId && questions.length && questions.every((q, index) => answers[getQuestionName(q, index)]));
  }, [answers, questions, quizSessionId]);

  const submitPayload = () => ({
    answers: questions.map((question, index) => ({
      questionId: getQuestionId(question, index),
      selectedAnswer: answers[getQuestionName(question, index)],
    })),
  });

  const handleSubmit = () => {
    if (!surveyModel.validate()) return;
    onSubmit?.(quizSessionId, submitPayload());
  };

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

        {questions.length > 0 && (
          <div className="quiz-survey-shell">
            <Survey model={surveyModel} />
          </div>
        )}

        <Button type="primary" disabled={!canSubmit || submitting} loading={submitting} onClick={handleSubmit}>
          Submit quiz
        </Button>
      </Space>
    </Card>
  );
}

export default QuizRunner;

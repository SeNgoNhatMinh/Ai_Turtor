import { Button, Card, Progress, Space, Tag, Typography } from 'antd';
import { RetweetOutlined } from '@ant-design/icons';
import AiAnswer from '../../components/AiAnswer';

const { Text, Title } = Typography;

const normalizeStatus = (status) => String(status || '').toUpperCase();

const getStatusLabel = (result) => {
  const reviewStatus = normalizeStatus(result?.teacherReviewStatus || result?.reviewStatus);
  if (reviewStatus.includes('REVIEWED')) return 'Teacher reviewed';
  if (result?.quizType === 'ASSIGNED' && normalizeStatus(result?.status) === 'SUBMITTED') return 'Waiting for teacher review';
  if (normalizeStatus(result?.status) === 'SUBMITTED') return 'Auto graded';
  return result?.status || 'Generated';
};

const getQuestionId = (question, index) => question?.questionId || question?.id || `question-${index}`;

const getAnswerMap = (answers) => {
  const map = new Map();
  (Array.isArray(answers) ? answers : []).forEach((answer) => {
    const key = answer?.questionId || answer?.id;
    if (key) map.set(key, answer);
  });
  return map;
};

function QuizResult({ result, onRetry, retryLoading = false }) {
  if (!result) return null;

  const score = Number(result.teacherReviewedScore ?? result.score ?? result.autoScore ?? 0);
  const maxScore = Number(result.maxScore ?? result.totalScore ?? result.questions?.length ?? 0);
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const questions = Array.isArray(result.questions) ? result.questions : [];
  const answerMap = getAnswerMap(result.answers);
  const status = getStatusLabel(result);

  return (
    <Card className="quiz-card quiz-result-card">
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div className="quiz-result-header">
          <div>
            <Title level={4} style={{ margin: 0 }}>Quiz result</Title>
            <Text type="secondary">{result.topic || result.title || 'Practice quiz'}</Text>
          </div>
          <Space wrap>
            <Tag color={percent >= 70 ? 'success' : percent >= 45 ? 'warning' : 'error'}>{status}</Tag>
            {result.quizType && <Tag>{result.quizType}</Tag>}
          </Space>
        </div>

        <div className="quiz-score-panel">
          <Progress percent={percent} strokeColor={percent >= 70 ? '#16A34A' : percent >= 45 ? '#F59E0B' : '#EF4444'} />
          <Text strong>Score: {score}/{maxScore}</Text>
          {result.teacherFeedback && <Text>{result.teacherFeedback}</Text>}
          {result.feedback && !result.teacherFeedback && <Text>{result.feedback}</Text>}
          {Array.isArray(result.weakTopics) && result.weakTopics.length > 0 && (
            <div>
              <Text type="secondary">Focus next: </Text>
              {result.weakTopics.map((topic) => <Tag key={topic}>{topic}</Tag>)}
            </div>
          )}
          {onRetry && (
            <Button icon={<RetweetOutlined />} loading={retryLoading} onClick={onRetry}>
              Retry from this topic
            </Button>
          )}
        </div>

        {questions.length > 0 && (
          <div className="quiz-result-questions">
            <Title level={5}>Detailed Review</Title>
            <div className="quiz-review-list">
              {questions.map((question, index) => {
                const answer = answerMap.get(getQuestionId(question, index)) || {};
                const selectedAnswer = answer.selectedAnswer || question.selectedAnswer || question.selectedOption || '';
                const correctAnswer = answer.correctAnswer || question.correctAnswer || question.correctOption || '';
                const explanation = answer.explanation || question.explanation || '';
                const isCorrect = answer.correct ?? question.isCorrect ?? (selectedAnswer && correctAnswer && selectedAnswer === correctAnswer);

                return (
                  <div key={getQuestionId(question, index)} className="quiz-review-item">
                    <div className="quiz-review-question">
                      <Text strong>Q{index + 1}. </Text>
                      <AiAnswer markdown={question.questionText || question.question || ''} />
                    </div>

                    <div className="quiz-review-answer-grid">
                      <div className="quiz-review-answer-row">
                        <Text type="secondary">Your answer</Text>
                        <Tag color={isCorrect ? 'success' : 'error'}>{selectedAnswer || 'No answer'}</Tag>
                        <Text type={isCorrect ? 'success' : 'danger'}>{isCorrect ? 'Correct' : 'Incorrect'}</Text>
                      </div>

                      {correctAnswer && (
                        <div className="quiz-review-answer-row">
                          <Text type="secondary">Correct answer</Text>
                          <Tag color="processing">{correctAnswer}</Tag>
                        </div>
                      )}

                      {explanation && (
                        <div className="quiz-review-explanation">
                          <Text strong type="secondary">Explanation</Text>
                          <AiAnswer markdown={explanation} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Space>
    </Card>
  );
}

export default QuizResult;

import { Card, Progress, Space, Tag, Typography, List, Divider } from 'antd';
import AiAnswer from '../../components/AiAnswer';

const { Text, Title } = Typography;

const getStatusLabel = (status) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized.includes('TEACHER_REVIEWED') || normalized.includes('REVIEWED')) return 'Teacher reviewed';
  if (normalized.includes('WAIT') || normalized.includes('PENDING')) return 'Waiting for teacher review';
  return 'Auto graded';
};

function QuizResult({ result }) {
  if (!result) return null;
  const score = Number(result.score ?? result.autoScore ?? result.reviewedScore ?? 0);
  const maxScore = Number(result.maxScore ?? result.totalScore ?? 10);
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return (
    <Card className="quiz-card quiz-result-card">
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div className="quiz-result-header">
          <div>
            <Title level={4} style={{ margin: 0 }}>Quiz result</Title>
            <Text type="secondary">{getStatusLabel(result.status || result.reviewStatus)}</Text>
          </div>
          <Tag color={percent >= 70 ? 'success' : percent >= 45 ? 'warning' : 'error'}>
            {getStatusLabel(result.status || result.reviewStatus)}
          </Tag>
        </div>
        <Progress percent={percent} strokeColor={percent >= 70 ? '#16A34A' : percent >= 45 ? '#F59E0B' : '#EF4444'} />
        <Text strong>Score: {score}/{maxScore}</Text>
        {result.feedback && <Text>{result.feedback}</Text>}
        {Array.isArray(result.weakTopics) && result.weakTopics.length > 0 && (
          <div>
            <Text type="secondary">Focus next: </Text>
            {result.weakTopics.map((topic) => <Tag key={topic}>{topic}</Tag>)}
          </div>
        )}

        {Array.isArray(result.questions) && result.questions.length > 0 && (
          <div className="quiz-result-questions" style={{ marginTop: 24 }}>
            <Title level={5}>Detailed Review</Title>
            <List
              itemLayout="vertical"
              dataSource={result.questions}
              renderItem={(q, idx) => {
                const isCorrect = q.isCorrect ?? (q.selectedOption === (q.correctOption || q.correctAnswer));
                return (
                  <List.Item>
                    <div style={{ marginBottom: 12 }}>
                      <Text strong>Q{idx + 1}. </Text>
                      <AiAnswer markdown={q.questionText || q.question || ''} />
                    </div>
                    
                    <div style={{ marginLeft: 16 }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Text type="secondary">Your answer:</Text>
                          <Tag color={isCorrect ? 'success' : 'error'}>
                            {q.selectedOption || 'No answer'}
                          </Tag>
                          {isCorrect ? (
                            <Text type="success">✓ Correct</Text>
                          ) : (
                            <Text type="danger">✗ Incorrect</Text>
                          )}
                        </div>
                        
                        {!isCorrect && (q.correctOption || q.correctAnswer) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Text type="secondary">Correct answer:</Text>
                            <Tag color="processing">{q.correctOption || q.correctAnswer}</Tag>
                          </div>
                        )}

                        {q.explanation && (
                          <div style={{ marginTop: 8, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
                            <Text strong type="secondary">Explanation: </Text>
                            <AiAnswer markdown={q.explanation} />
                          </div>
                        )}
                      </Space>
                    </div>
                  </List.Item>
                );
              }}
            />
          </div>
        )}
      </Space>
    </Card>
  );
}

export default QuizResult;

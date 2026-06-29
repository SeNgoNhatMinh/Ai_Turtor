import { Card, Progress, Space, Tag, Typography } from 'antd';

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
      </Space>
    </Card>
  );
}

export default QuizResult;

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Input, InputNumber, List, Select, Space, Spin, Tag, Typography } from 'antd';
import { apiService } from '../../services/api';
import { getUserFacingError } from '../../services/apiClient';
import QuizRunner from './QuizRunner';
import QuizResult from './QuizResult';
import './Quiz.css';

const { Text, Title } = Typography;

const getSuggestionText = (suggestion) => suggestion?.title || suggestion?.content || String(suggestion || '');
const getQuizId = (quiz) => quiz?.quizSessionId || quiz?.sessionId || quiz?.id || quiz?.assignmentId;

function PracticeQuizzes({
  studentId,
  courseId,
  classId,
  suggestions = [],
  initialSuggestion = '',
  triggerToast,
  onAfterQuizSubmit,
}) {
  const [topic, setTopic] = useState(initialSuggestion || '');
  const [questionCount, setQuestionCount] = useState(5);
  const [history, setHistory] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialSuggestion) setTopic(initialSuggestion);
  }, [initialSuggestion]);

  const suggestionOptions = useMemo(() => {
    const unique = [...new Set((suggestions || []).map(getSuggestionText).filter(Boolean))];
    return unique.map((value) => ({ value, label: value.length > 80 ? `${value.slice(0, 80)}...` : value }));
  }, [suggestions]);

  const loadQuizzes = async () => {
    if (!studentId || !courseId) return;
    setError('');
    try {
      const [historyData, assignedData] = await Promise.all([
        apiService.getStudentQuizHistory(studentId, courseId),
        apiService.getAssignedQuizzes(studentId, courseId, classId),
      ]);
      setHistory(historyData);
      setAssigned(assignedData);
    } catch (err) {
      setError(getUserFacingError(err, 'Unable to load quizzes.'));
    }
  };

  useEffect(() => {
    loadQuizzes();
  }, [studentId, courseId, classId]);

  const generateQuiz = async () => {
    if (!topic.trim()) {
      triggerToast?.('Choose a topic or suggestion first.');
      return;
    }
    setLoading(true);
    setError('');
    setLastResult(null);
    try {
      const quiz = await apiService.generateSelfQuiz(studentId, courseId, {
        classId,
        topic,
        suggestionText: topic,
        questionCount,
      });
      setActiveQuiz(quiz);
      loadQuizzes();
    } catch (err) {
      setError(getUserFacingError(err, 'Not enough indexed course material to generate this quiz. Please upload or reindex materials first.'));
    } finally {
      setLoading(false);
    }
  };

  const startAssignedQuiz = async (assignment) => {
    setLoading(true);
    setError('');
    setLastResult(null);
    try {
      const quiz = await apiService.startQuizAssignmentAttempt(assignment.assignmentId || assignment.id, studentId);
      setActiveQuiz(quiz);
    } catch (err) {
      setError(getUserFacingError(err, 'Unable to start assigned quiz.'));
    } finally {
      setLoading(false);
    }
  };

  const submitQuiz = async (quizSessionId, payload) => {
    setSubmitting(true);
    try {
      const result = await apiService.submitQuiz(quizSessionId, payload);
      setLastResult(result);
      setActiveQuiz(null);
      await loadQuizzes();
      onAfterQuizSubmit?.();
      triggerToast?.('Quiz submitted.');
    } catch (err) {
      triggerToast?.(getUserFacingError(err, 'Unable to submit quiz.'));
    } finally {
      setSubmitting(false);
    }
  };

  const viewQuizHistory = async (quizId, status) => {
    setLoading(true);
    setError('');
    try {
      const quiz = await apiService.getQuiz(quizId);
      if (status === 'GENERATED' || quiz.status === 'GENERATED') {
        setActiveQuiz(quiz);
        setLastResult(null);
      } else {
        setLastResult(quiz);
        setActiveQuiz(null);
      }
    } catch (err) {
      setError(getUserFacingError(err, 'Unable to load quiz details.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-section quiz-page">
      <div className="quiz-page-header">
        <div>
          <Title level={3} style={{ margin: 0 }}>Practice Quizzes</Title>
          <Text type="secondary">Self-study from course materials or complete teacher-assigned quizzes.</Text>
        </div>
        <Tag color="orange">Course: {courseId}</Tag>
      </div>

      {error && <Alert type="warning" showIcon message={error} className="quiz-alert" />}

      <div className="quiz-grid">
        <Card className="quiz-card" title="Self-study quiz">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Select
              showSearch
              allowClear
              value={topic || undefined}
              onChange={(value) => setTopic(value || '')}
              onSearch={setTopic}
              placeholder="Choose or type a topic/suggestion"
              options={suggestionOptions}
            />
            <Input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic or suggestion text" />
            <InputNumber min={3} max={15} value={questionCount} onChange={(value) => setQuestionCount(value || 5)} addonBefore="Questions" />
            <Button type="primary" loading={loading} onClick={generateQuiz}>Generate self-study quiz</Button>
          </Space>
        </Card>

        <Card className="quiz-card" title="Assigned quizzes">
          {assigned.length ? (
            <List
              dataSource={assigned}
              renderItem={(item) => (
                <List.Item
                  actions={[<Button key="start" size="small" onClick={() => startAssignedQuiz(item)}>Start</Button>]}
                >
                  <List.Item.Meta
                    title={item.title || item.topic || 'Assigned quiz'}
                    description={<span>{item.status || 'Assigned'} {item.classId ? `- ${item.classId}` : ''}</span>}
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No assigned quizzes for this course" />
          )}
        </Card>
      </div>

      {loading && <Spin description="Preparing quiz from indexed course materials..." />}
      {activeQuiz && <QuizRunner quiz={activeQuiz} onSubmit={submitQuiz} submitting={submitting} />}
      {lastResult && <QuizResult result={lastResult} />}

      <Card className="quiz-card" title="Self-study quiz history">
        {history.length ? (
          <List
            dataSource={history}
            renderItem={(item) => (
              <List.Item 
                key={getQuizId(item)}
                actions={[
                  <Button 
                    key="view" 
                    size="small" 
                    onClick={() => viewQuizHistory(getQuizId(item), item.status)}
                  >
                    {item.status === 'GENERATED' ? 'Continue' : 'Review'}
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={item.title || item.topic || 'Practice quiz'}
                  description={`Status: ${item.status || 'Submitted'}${item.score != null ? ` - Score: ${item.score}` : ''}`}
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No self-study quizzes yet" />
        )}
      </Card>
    </div>
  );
}

export default PracticeQuizzes;

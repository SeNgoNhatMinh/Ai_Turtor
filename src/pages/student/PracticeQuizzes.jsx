import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  List,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  FileSearchOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  RetweetOutlined,
} from '@ant-design/icons';
import { apiService } from '../../services/api';
import { getUserFacingError } from '../../services/apiClient';
import QuizRunner from './QuizRunner';
import QuizResult from './QuizResult';
import './Quiz.css';

const { Text, Title } = Typography;

const getSuggestionText = (suggestion) => suggestion?.title || suggestion?.content || String(suggestion || '');
const getQuizId = (quiz) => quiz?.quizSessionId || quiz?.sessionId || quiz?.id;
const getAssignmentId = (assignment) => assignment?.assignmentId || assignment?.id;

const normalizeStatus = (status) => String(status || '').toUpperCase();

const statusColor = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized.includes('SUBMITTED') || normalized.includes('REVIEWED')) return 'success';
  if (normalized.includes('GENERATED') || normalized.includes('DRAFT')) return 'processing';
  if (normalized.includes('PUBLISHED') || normalized.includes('ASSIGNED')) return 'blue';
  return 'default';
};

const statusLabel = (item) => {
  const normalized = normalizeStatus(item?.teacherReviewStatus || item?.reviewStatus || item?.status);
  if (normalized.includes('REVIEWED')) return 'Teacher reviewed';
  if (normalized.includes('PENDING') || normalized.includes('WAIT')) return 'Waiting teacher review';
  if (normalizeStatus(item?.status) === 'SUBMITTED') return item?.quizType === 'ASSIGNED' ? 'Submitted - waiting review' : 'Submitted';
  if (normalizeStatus(item?.status) === 'GENERATED') return 'In progress';
  if (normalizeStatus(item?.status) === 'PUBLISHED') return 'Published';
  return item?.status || 'Available';
};

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
  const [loadingKey, setLoadingKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('generate');

  const hasContext = Boolean(studentId && courseId);
  const isLoading = Boolean(loadingKey);

  useEffect(() => {
    if (initialSuggestion) {
      setTopic(initialSuggestion);
      setActiveTab('generate');
    }
  }, [initialSuggestion]);

  const suggestionOptions = useMemo(() => {
    const unique = [...new Set((suggestions || []).map(getSuggestionText).filter(Boolean))];
    return unique.map((value) => ({ value, label: value.length > 92 ? `${value.slice(0, 92)}...` : value }));
  }, [suggestions]);

  const sortedHistory = useMemo(() => (
    [...history].sort((a, b) => new Date(b.updatedAt || b.submittedAt || b.createdAt || 0) - new Date(a.updatedAt || a.submittedAt || a.createdAt || 0))
  ), [history]);

  const loadQuizzes = async () => {
    if (!hasContext) {
      setHistory([]);
      setAssigned([]);
      return;
    }
    setLoadingKey('refresh');
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
    } finally {
      setLoadingKey('');
    }
  };

  useEffect(() => {
    loadQuizzes();
  }, [studentId, courseId, classId]);

  const generateQuiz = async (overrideTopic = '') => {
    const selectedTopic = String(overrideTopic || topic || '').trim();
    if (!hasContext) {
      setError('Choose a course before generating a quiz.');
      return;
    }
    if (!selectedTopic) {
      triggerToast?.('Choose a topic or suggestion first.');
      return;
    }

    setLoadingKey('generate');
    setError('');
    setLastResult(null);
    try {
      const quiz = await apiService.generateSelfQuiz(studentId, courseId, {
        classId,
        topic: selectedTopic,
        suggestionText: selectedTopic,
        questionCount,
      });
      setTopic(selectedTopic);
      setActiveQuiz(quiz);
      setActiveTab('active');
      await loadQuizzes();
    } catch (err) {
      setError(getUserFacingError(err, 'Not enough indexed course material to generate this quiz. Please upload or reindex materials first.'));
    } finally {
      setLoadingKey('');
    }
  };

  const startAssignedQuiz = async (assignment) => {
    const assignmentId = getAssignmentId(assignment);
    if (!assignmentId || !studentId) return;
    setLoadingKey(`assignment:${assignmentId}`);
    setError('');
    setLastResult(null);
    try {
      const quiz = await apiService.startQuizAssignmentAttempt(assignmentId, studentId);
      setActiveQuiz(quiz);
      setActiveTab('active');
    } catch (err) {
      setError(getUserFacingError(err, 'Unable to start assigned quiz.'));
    } finally {
      setLoadingKey('');
    }
  };

  const submitQuiz = async (quizSessionId, payload) => {
    setSubmitting(true);
    setError('');
    try {
      const result = await apiService.submitQuiz(quizSessionId, payload);
      setLastResult(result);
      setActiveQuiz(null);
      setActiveTab('result');
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
    if (!quizId) return;
    setLoadingKey(`quiz:${quizId}`);
    setError('');
    try {
      const quiz = await apiService.getQuiz(quizId);
      if (normalizeStatus(status) === 'GENERATED' || normalizeStatus(quiz.status) === 'GENERATED') {
        setActiveQuiz(quiz);
        setLastResult(null);
        setActiveTab('active');
      } else {
        setLastResult(quiz);
        setActiveQuiz(null);
        setActiveTab('result');
      }
    } catch (err) {
      setError(getUserFacingError(err, 'Unable to load quiz details.'));
    } finally {
      setLoadingKey('');
    }
  };

  const retryFromResult = () => {
    const retryTopic = lastResult?.topic || lastResult?.suggestionText || topic;
    if (retryTopic) generateQuiz(retryTopic);
  };

  const generatePanel = (
    <Card className="quiz-card quiz-generate-card" title="Generate Quiz">
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="Quizzes are generated from indexed course materials"
          description="If there is not enough indexed content for this topic, AI Tutor will not create a quiz."
        />
        <Select
          showSearch
          allowClear
          value={topic || undefined}
          onChange={(value) => setTopic(value || '')}
          onSearch={setTopic}
          placeholder="Choose or type a suggestion"
          options={suggestionOptions}
          disabled={!hasContext || isLoading}
        />
        <Input
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Topic or suggestion text"
          disabled={!hasContext || isLoading}
        />
        <InputNumber
          min={3}
          max={10}
          value={questionCount}
          onChange={(value) => setQuestionCount(value || 5)}
          addonBefore="Questions"
          disabled={!hasContext || isLoading}
        />
        <Button
          type="primary"
          icon={<QuestionCircleOutlined />}
          loading={loadingKey === 'generate'}
          disabled={!hasContext || !topic.trim() || isLoading}
          onClick={() => generateQuiz()}
        >
          Generate self-study quiz
        </Button>
      </Space>
    </Card>
  );

  const assignedPanel = (
    <Card
      className="quiz-card"
      title="Assigned Quizzes"
      extra={<Button size="small" icon={<ReloadOutlined />} onClick={loadQuizzes} loading={loadingKey === 'refresh'} disabled={!hasContext}>Refresh quizzes</Button>}
    >
      {assigned.length ? (
        <List
          dataSource={assigned}
          renderItem={(item) => {
            const assignmentId = getAssignmentId(item);
            return (
              <List.Item
                className="quiz-list-item"
                actions={[
                  <Button
                    key="start"
                    size="small"
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    loading={loadingKey === `assignment:${assignmentId}`}
                    disabled={!hasContext || isLoading}
                    onClick={() => startAssignedQuiz(item)}
                  >
                    Start
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={<Space wrap><span>{item.title || item.topic || 'Assigned quiz'}</span><Tag color={statusColor(item.status)}>{statusLabel(item)}</Tag></Space>}
                  description={<span>{item.classId ? `Class ${item.classId}` : 'Course assignment'}{item.questionCount ? ` • ${item.questionCount} questions` : ''}</span>}
                />
              </List.Item>
            );
          }}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No assigned quizzes for this course" />
      )}
    </Card>
  );

  const historyPanel = (
    <Card
      className="quiz-card"
      title="Quiz History"
      extra={<Button size="small" icon={<ReloadOutlined />} onClick={loadQuizzes} loading={loadingKey === 'refresh'} disabled={!hasContext}>Refresh quizzes</Button>}
    >
      {sortedHistory.length ? (
        <List
          dataSource={sortedHistory}
          renderItem={(item) => {
            const quizId = getQuizId(item);
            const isGenerated = normalizeStatus(item.status) === 'GENERATED';
            return (
              <List.Item
                key={quizId}
                className="quiz-list-item"
                actions={[
                  <Button
                    key="view"
                    size="small"
                    icon={isGenerated ? <PlayCircleOutlined /> : <FileSearchOutlined />}
                    loading={loadingKey === `quiz:${quizId}`}
                    disabled={!hasContext || isLoading}
                    onClick={() => viewQuizHistory(quizId, item.status)}
                  >
                    {isGenerated ? 'Continue' : 'Review result'}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={<Space wrap><span>{item.title || item.topic || 'Practice quiz'}</span><Tag color={statusColor(item.status)}>{statusLabel(item)}</Tag></Space>}
                  description={`Score: ${item.score ?? 0}/${item.maxScore ?? '-'}${item.quizType ? ` • ${item.quizType}` : ''}`}
                />
              </List.Item>
            );
          }}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No self-study quizzes yet" />
      )}
    </Card>
  );

  return (
    <div className="portal-section quiz-page">
      <div className="quiz-page-header">
        <div>
          <Title level={3} style={{ margin: 0 }}>Practice Quizzes</Title>
          <Text type="secondary">Generate self-study quizzes from course materials, complete assigned quizzes, and review results.</Text>
        </div>
        <Space wrap>
          {courseId && <Tag color="orange">Course: {courseId}</Tag>}
          {classId && <Tag>Class: {classId}</Tag>}
        </Space>
      </div>

      {!hasContext && (
        <Alert type="warning" showIcon message="Choose a course first" description="Practice quizzes require a student and course context." className="quiz-alert" />
      )}
      {error && <Alert type="warning" showIcon message={error} className="quiz-alert" />}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'generate', label: 'Generate Quiz', children: generatePanel },
          { key: 'active', label: 'Active Quiz', children: activeQuiz ? <QuizRunner quiz={activeQuiz} onSubmit={submitQuiz} submitting={submitting} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No active quiz. Generate or continue a quiz to start." /> },
          { key: 'assigned', label: `Assigned Quizzes${assigned.length ? ` (${assigned.length})` : ''}`, children: assignedPanel },
          { key: 'history', label: `Quiz History${sortedHistory.length ? ` (${sortedHistory.length})` : ''}`, children: historyPanel },
          {
            key: 'result',
            label: 'Result Review',
            children: lastResult ? (
              <QuizResult result={lastResult} onRetry={retryFromResult} retryLoading={loadingKey === 'generate'} />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No quiz result selected yet." />
            ),
          },
        ]}
      />

      {loadingKey === 'generate' && (
        <div className="quiz-loading-inline">
          <Spin description="Preparing quiz from indexed course materials..." />
        </div>
      )}
    </div>
  );
}

export default PracticeQuizzes;

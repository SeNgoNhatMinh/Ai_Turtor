import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileSearchOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  TrophyOutlined,
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

const formatDateTime = (value) => {
  if (!value) return 'No activity yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No activity yet';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

const getScoreText = (item) => {
  if (item?.score == null && item?.autoScore == null && item?.teacherReviewedScore == null) return 'Not submitted yet';
  const score = item.teacherReviewedScore ?? item.score ?? item.autoScore ?? 0;
  const maxScore = item.maxScore ?? item.totalScore ?? item.questionCount ?? '-';
  return `Score ${score}/${maxScore}`;
};

const getQuestionCount = (item) => {
  if (item?.questionCount) return item.questionCount;
  if (Array.isArray(item?.questions)) return item.questions.length;
  return null;
};

function QuizStatCard({ icon, label, value, description, tone = 'neutral' }) {
  return (
    <div className={`quiz-stat-card quiz-stat-card--${tone}`}>
      <div className="quiz-stat-icon">{icon}</div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        {description && <small>{description}</small>}
      </div>
    </div>
  );
}

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

  const quizStats = useMemo(() => {
    const inProgress = sortedHistory.filter((item) => normalizeStatus(item.status) === 'GENERATED').length;
    const submitted = sortedHistory.filter((item) => normalizeStatus(item.status) === 'SUBMITTED').length;
    const reviewed = sortedHistory.filter((item) => normalizeStatus(item.teacherReviewStatus || item.reviewStatus).includes('REVIEWED')).length;
    const latest = sortedHistory[0]?.updatedAt || sortedHistory[0]?.submittedAt || sortedHistory[0]?.createdAt;
    return {
      assigned: assigned.length,
      inProgress,
      submitted,
      reviewed,
      latest,
    };
  }, [assigned.length, sortedHistory]);

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

  const renderQuizItem = (item, action) => {
    const questionCountValue = getQuestionCount(item);
    return (
      <div key={getQuizId(item) || getAssignmentId(item) || item.title || item.topic} className="quiz-item-card">
        <div className="quiz-item-main">
          <div className="quiz-item-title-row">
            <strong>{item.title || item.topic || 'Practice quiz'}</strong>
            <Tag color={statusColor(item.status)}>{statusLabel(item)}</Tag>
          </div>
          <div className="quiz-item-meta">
            {item.quizType && <span>{item.quizType}</span>}
            {item.classId && <span>Class {item.classId}</span>}
            {questionCountValue && <span>{questionCountValue} questions</span>}
            <span>{getScoreText(item)}</span>
            <span>{formatDateTime(item.updatedAt || item.submittedAt || item.createdAt || item.publishedAt)}</span>
          </div>
        </div>
        <div className="quiz-item-action">{action}</div>
      </div>
    );
  };

  const generatePanel = (
    <div className="quiz-generate-layout">
      <Card
        className="quiz-card quiz-generate-card"
        title={<span className="quiz-card-title">Create a self-study quiz</span>}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="Grounded in course materials"
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
              addonBefore="Questions"
              disabled={!hasContext || isLoading}
            />
          </div>

          <Button
            type="primary"
            size="large"
            block
            icon={<QuestionCircleOutlined />}
            loading={loadingKey === 'generate'}
            disabled={!hasContext || !topic.trim() || isLoading}
            onClick={() => generateQuiz()}
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
                <button key={item.value} type="button" onClick={() => setTopic(item.value)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );

  const assignedPanel = (
    <Card
      className="quiz-card"
      title="Assigned Quizzes"
      extra={<Button size="small" icon={<ReloadOutlined />} onClick={loadQuizzes} loading={loadingKey === 'refresh'} disabled={!hasContext}>Refresh quizzes</Button>}
    >
      {assigned.length ? (
        <div className="quiz-item-list">
          {assigned.map((item) => {
            const assignmentId = getAssignmentId(item);
            return renderQuizItem(
              item,
              (
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
                </Button>
              ),
            );
          })}
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No assigned quizzes for this course"
        >
          <Button icon={<ReloadOutlined />} onClick={loadQuizzes} disabled={!hasContext} loading={loadingKey === 'refresh'}>
            Check again
          </Button>
        </Empty>
      )}
    </Card>
  );

  const historyPanel = (
    <Card
      className="quiz-card"
      title="Quiz History"
      extra={<Button size="small" icon={<ReloadOutlined />} onClick={loadQuizzes} loading={loadingKey === 'refresh'} disabled={!hasContext}>Refresh</Button>}
    >
      {sortedHistory.length ? (
        <div className="quiz-item-list">
          {sortedHistory.map((item) => {
            const quizId = getQuizId(item);
            const isGenerated = normalizeStatus(item.status) === 'GENERATED';
            return renderQuizItem(
              item,
              (
                <Button
                  key="view"
                  size="small"
                  icon={isGenerated ? <PlayCircleOutlined /> : <FileSearchOutlined />}
                  loading={loadingKey === `quiz:${quizId}`}
                  disabled={!hasContext || isLoading}
                  onClick={() => viewQuizHistory(quizId, item.status)}
                >
                  {isGenerated ? 'Continue' : 'Review'}
                </Button>
              ),
            );
          })}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No self-study quizzes yet">
          <Button type="primary" icon={<QuestionCircleOutlined />} onClick={() => setActiveTab('generate')}>
            Generate your first quiz
          </Button>
        </Empty>
      )}
    </Card>
  );

  return (
    <div className="portal-section quiz-page">
      <div className="quiz-hero">
        <div className="quiz-hero-copy">
          <span className="quiz-eyebrow">Practice Quizzes</span>
          <Title level={3} style={{ margin: 0 }}>Practice with material-grounded quizzes</Title>
          <Text>
            Generate focused self-study quizzes, complete teacher assignments, and review mistakes without exposing answers before submit.
          </Text>
        </div>
        <div className="quiz-hero-actions">
          <Space wrap>
            {courseId && <Tag color="orange">Course: {courseId}</Tag>}
            {classId && <Tag>Class: {classId}</Tag>}
          </Space>
          <Button icon={<ReloadOutlined />} onClick={loadQuizzes} loading={loadingKey === 'refresh'} disabled={!hasContext}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="quiz-stat-grid">
        <QuizStatCard
          icon={<BookOutlined />}
          label="Assigned"
          value={quizStats.assigned}
          description="From teacher"
          tone="blue"
        />
        <QuizStatCard
          icon={<ClockCircleOutlined />}
          label="In progress"
          value={quizStats.inProgress}
          description="Can continue"
          tone="orange"
        />
        <QuizStatCard
          icon={<CheckCircleOutlined />}
          label="Submitted"
          value={quizStats.submitted}
          description="Auto graded"
          tone="green"
        />
        <QuizStatCard
          icon={<TrophyOutlined />}
          label="Latest activity"
          value={formatDateTime(quizStats.latest)}
          description={quizStats.reviewed ? `${quizStats.reviewed} reviewed by teacher` : 'No teacher review yet'}
          tone="neutral"
        />
      </div>

      {!hasContext && (
        <Alert type="warning" showIcon message="Choose a course first" description="Practice quizzes require a student and course context." className="quiz-alert" />
      )}
      {error && <Alert type="warning" showIcon message={error} className="quiz-alert" />}

      {activeQuiz && activeTab !== 'active' && (
        <Alert
          type="success"
          showIcon
          className="quiz-alert"
          message="You have an active quiz ready"
          action={<Button size="small" type="primary" onClick={() => setActiveTab('active')}>Continue quiz</Button>}
        />
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        className="quiz-tabs"
        items={[
          { key: 'generate', label: 'Generate', children: generatePanel },
          { key: 'active', label: activeQuiz ? 'Active Quiz' : 'Active', children: activeQuiz ? <QuizRunner quiz={activeQuiz} onSubmit={submitQuiz} submitting={submitting} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No active quiz. Generate or continue a quiz to start." /> },
          { key: 'assigned', label: `Assigned${assigned.length ? ` (${assigned.length})` : ''}`, children: assignedPanel },
          { key: 'history', label: `History${sortedHistory.length ? ` (${sortedHistory.length})` : ''}`, children: historyPanel },
          {
            key: 'result',
            label: 'Review',
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

import { lazy, Suspense } from 'react';
import { Alert, Button, Empty, Space, Spin, Tabs, Tag, Typography } from 'antd';
import {
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import AssignedQuizzesPanel from '../../features/student/quizzes/AssignedQuizzesPanel';
import QuizGeneratePanel from '../../features/student/quizzes/QuizGeneratePanel';
import QuizHistoryPanel from '../../features/student/quizzes/QuizHistoryPanel';
import QuizStatCard from '../../features/student/quizzes/QuizStatCard';
import { formatQuizDateTime } from '../../features/student/quizzes/practiceQuizUtils';
import { usePracticeQuizzes } from '../../features/student/quizzes/usePracticeQuizzes';
import AsyncState from '../../components/common/AsyncState';
import { uiCopy } from '../../constants/uiCopy';
import './Quiz.css';

const QuizRunner = lazy(() => import('./QuizRunner'));
const QuizResult = lazy(() => import('./QuizResult'));

const { Text, Title } = Typography;

function PracticeQuizzes({
  studentId,
  courseId,
  classId,
  suggestions = [],
  initialSuggestion = '',
  triggerToast,
  onAfterQuizSubmit,
}) {
  const quiz = usePracticeQuizzes({
    studentId,
    courseId,
    classId,
    suggestions,
    initialSuggestion,
    triggerToast,
    onAfterQuizSubmit,
  });

  const tabs = [
    {
      key: 'generate',
      label: 'Generate',
      children: (
        <QuizGeneratePanel
          topic={quiz.topic}
          setTopic={quiz.setTopic}
          questionCount={quiz.questionCount}
          setQuestionCount={quiz.setQuestionCount}
          suggestionOptions={quiz.suggestionOptions}
          hasContext={quiz.hasContext}
          isLoading={quiz.isLoading}
          isGenerating={quiz.loadingKey === 'generate'}
          onGenerate={quiz.generateQuiz}
        />
      ),
    },
    {
      key: 'active',
      label: quiz.activeQuiz ? 'Active Quiz' : 'Active',
      children: quiz.activeQuiz ? (
        <Suspense fallback={<div className="portal-loading">Loading quiz...</div>}>
          <QuizRunner quiz={quiz.activeQuiz} onSubmit={quiz.submitQuiz} submitting={quiz.submitting} />
        </Suspense>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={uiCopy.student.quizzes.noActive} />
      ),
    },
    {
      key: 'assigned',
      label: `Assigned${quiz.assigned.length ? ` (${quiz.assigned.length})` : ''}`,
      children: (
        <AssignedQuizzesPanel
          assignments={quiz.assigned}
          loadingKey={quiz.loadingKey}
          hasContext={quiz.hasContext}
          isLoading={quiz.isLoading}
          onRefresh={quiz.loadQuizzes}
          onStart={quiz.startAssignedQuiz}
        />
      ),
    },
    {
      key: 'history',
      label: `History${quiz.history.length ? ` (${quiz.history.length})` : ''}`,
      children: (
        <QuizHistoryPanel
          history={quiz.history}
          loadingKey={quiz.loadingKey}
          hasContext={quiz.hasContext}
          isLoading={quiz.isLoading}
          onRefresh={quiz.loadQuizzes}
          onView={quiz.viewQuizHistory}
          onGenerateFirst={() => quiz.setActiveTab('generate')}
        />
      ),
    },
    {
      key: 'result',
      label: 'Review',
      children: quiz.lastResult ? (
        <Suspense fallback={<div className="portal-loading">Loading quiz review...</div>}>
          <QuizResult
            result={quiz.lastResult}
            onRetry={quiz.retryFromResult}
            retryLoading={quiz.loadingKey === 'generate'}
          />
        </Suspense>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={uiCopy.student.quizzes.noResult} />
      ),
    },
  ];

  return (
    <div className="portal-section quiz-page">
      <div className="quiz-hero">
        <div className="quiz-hero-copy">
          <span className="quiz-eyebrow">Practice Quizzes</span>
          <Title level={3} style={{ margin: 0 }}>{uiCopy.student.quizzes.title}</Title>
          <Text>{uiCopy.student.quizzes.subtitle}</Text>
        </div>
        <div className="quiz-hero-actions">
          <Space wrap>
            {courseId && <Tag color="orange">Course: {courseId}</Tag>}
            {classId && <Tag>Class: {classId}</Tag>}
          </Space>
          <Button icon={<ReloadOutlined />} onClick={quiz.loadQuizzes} loading={quiz.loadingKey === 'refresh'} disabled={!quiz.hasContext}>
            {uiCopy.common.refresh}
          </Button>
        </div>
      </div>

      <div className="quiz-stat-grid">
        <QuizStatCard icon={<BookOutlined />} label="Assigned" value={quiz.quizStats.assigned} description="From teacher" tone="blue" />
        <QuizStatCard icon={<ClockCircleOutlined />} label="In progress" value={quiz.quizStats.inProgress} description="Can continue" tone="orange" />
        <QuizStatCard icon={<CheckCircleOutlined />} label="Submitted" value={quiz.quizStats.submitted} description="Auto graded" tone="green" />
        <QuizStatCard
          icon={<TrophyOutlined />}
          label="Latest activity"
          value={formatQuizDateTime(quiz.quizStats.latest)}
          description={quiz.quizStats.reviewed ? `${quiz.quizStats.reviewed} reviewed by teacher` : 'No teacher review yet'}
        />
      </div>

      {!quiz.hasContext && (
        <Alert
          type="warning"
          showIcon
          message="Choose a course first"
          description={uiCopy.student.quizzes.contextRequired}
          className="quiz-alert"
        />
      )}
      {quiz.error && (
        <AsyncState error={quiz.error} onRetry={quiz.loadQuizzes} compact />
      )}

      {quiz.activeQuiz && quiz.activeTab !== 'active' && (
        <Alert
          type="success"
          showIcon
          className="quiz-alert"
          message={uiCopy.student.quizzes.activeReady}
          action={<Button size="small" type="primary" onClick={() => quiz.setActiveTab('active')}>Continue quiz</Button>}
        />
      )}

      <Tabs activeKey={quiz.activeTab} onChange={quiz.setActiveTab} className="quiz-tabs" items={tabs} />

      {quiz.loadingKey === 'generate' && (
        <div className="quiz-loading-inline">
          <Spin description={uiCopy.student.quizzes.preparing} />
        </div>
      )}
    </div>
  );
}

export default PracticeQuizzes;

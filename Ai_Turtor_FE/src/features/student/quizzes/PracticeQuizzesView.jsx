import { lazy, Suspense } from 'react';
import { Alert, Button, Empty, Space, Spin, Tag } from 'antd';
import {
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import AssignedQuizzesPanel from './AssignedQuizzesPanel';
import QuizGeneratePanel from './QuizGeneratePanel';
import QuizHistoryPanel from './QuizHistoryPanel';
import QuizStatCard from './QuizStatCard';
import { formatQuizDateTime } from './practiceQuizUtils';
import { usePracticeQuizzes } from './usePracticeQuizzes';
import AsyncState from '../../../components/common/AsyncState';
import AppTabs from '../../../components/common/AppTabs';
import PageHeader from '../../../components/common/PageHeader';
import { uiCopy } from '../../../constants/uiCopy';
import './Quiz.css';

const QuizRunner = lazy(() => import('./QuizRunner'));
const QuizResult = lazy(() => import('./QuizResult'));

function PracticeQuizzesView({
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
      label: 'Tạo quiz',
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
      label: quiz.activeQuiz ? 'Quiz đang làm' : 'Đang làm',
      children: quiz.activeQuiz ? (
        <Suspense fallback={<div className="portal-loading">Đang tải quiz...</div>}>
          <QuizRunner quiz={quiz.activeQuiz} onSubmit={quiz.submitQuiz} submitting={quiz.submitting} />
        </Suspense>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={uiCopy.student.quizzes.noActive} />
      ),
    },
    {
      key: 'assigned',
      label: `Được giao${quiz.assigned.length ? ` (${quiz.assigned.length})` : ''}`,
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
      label: `Lịch sử${quiz.history.length ? ` (${quiz.history.length})` : ''}`,
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
      label: 'Xem kết quả',
      children: quiz.lastResult ? (
        <Suspense fallback={<div className="portal-loading">Đang tải kết quả quiz...</div>}>
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
      <PageHeader
        eyebrow="Quiz luyện tập"
        title={uiCopy.student.quizzes.title}
        description={uiCopy.student.quizzes.subtitle}
        actions={(
          <>
            <Space wrap>
              {courseId && <Tag color="orange">Môn: {courseId}</Tag>}
              {classId && <Tag>Lớp: {classId}</Tag>}
            </Space>
            <Button icon={<ReloadOutlined />} onClick={quiz.loadQuizzes} loading={quiz.loadingKey === 'refresh'} disabled={!quiz.hasContext}>
              {uiCopy.common.refresh}
            </Button>
          </>
        )}
      />

      <div className="quiz-stat-grid">
        <QuizStatCard icon={<BookOutlined />} label="Được giao" value={quiz.quizStats.assigned} description="Từ giảng viên" tone="blue" />
        <QuizStatCard icon={<ClockCircleOutlined />} label="Đang làm" value={quiz.quizStats.inProgress} description="Có thể tiếp tục" tone="orange" />
        <QuizStatCard icon={<CheckCircleOutlined />} label="Đã nộp" value={quiz.quizStats.submitted} description="Đã gửi chấm" tone="green" />
        <QuizStatCard
          icon={<TrophyOutlined />}
          label="Hoạt động gần nhất"
          value={formatQuizDateTime(quiz.quizStats.latest)}
          description={quiz.quizStats.reviewed ? `${quiz.quizStats.reviewed} bài đã được giảng viên duyệt` : 'Chưa có bài được giảng viên duyệt'}
        />
      </div>

      {!quiz.hasContext && (
        <Alert
          type="warning"
          showIcon
          title="Hãy chọn môn học"
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
          title={uiCopy.student.quizzes.activeReady}
          action={<Button size="small" type="primary" onClick={() => quiz.setActiveTab('active')}>Tiếp tục làm</Button>}
        />
      )}

      <AppTabs activeKey={quiz.activeTab} onChange={quiz.setActiveTab} className="quiz-tabs" items={tabs} />

      {quiz.loadingKey === 'generate' && (
        <div className="quiz-loading-inline">
          <Spin description={uiCopy.student.quizzes.preparing} />
        </div>
      )}
    </div>
  );
}

export default PracticeQuizzesView;

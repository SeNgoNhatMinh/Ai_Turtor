import LearningProgress from '../../../pages/student/LearningProgress';
import { useStudentLearningActions } from './useStudentLearningActions';
import { useStudentLearningController } from './useStudentLearningController';
import { useStudentNextSteps } from './useStudentNextSteps';

export default function LearningProgressPage({
  studentId,
  courseId,
  classId,
  switchTab,
  triggerToast,
}) {
  const learning = useStudentLearningController({
    studentId,
    courseId,
    classId,
    switchTab,
    triggerToast,
  });
  const actions = useStudentLearningActions({
    activeTab: 'student-memory',
    userId: studentId,
    courseId,
    classId,
    switchTab,
    loadStudentDashboard: learning.loadStudentDashboard,
    triggerToast,
  });
  const dashboard = learning.studentDashboard || {};
  const nextSteps = useStudentNextSteps({ studentId, courseId, classId });

  return (
    <LearningProgress
      learnedTopics={Array.isArray(dashboard.learnedTopics) ? dashboard.learnedTopics : []}
      weakTopics={Array.isArray(dashboard.weakTopics) ? dashboard.weakTopics : []}
      suggestions={learning.suggestions}
      isSuggesting={learning.isSuggesting}
      refreshSuggestions={learning.refreshSuggestions}
      isLoading={learning.isStudentDashboardLoading}
      dashboardStats={dashboard.stats}
      onRefreshDashboard={learning.loadStudentDashboard}
      onUpdateMemory={learning.handleStudentUpdateMemory}
      pinnedSuggestions={dashboard.pinnedImproveSuggestions || []}
      onPinSuggestion={learning.handlePinImproveSuggestion}
      onUnpinSuggestion={learning.handleUnpinImproveSuggestion}
      onStudySuggestion={actions.handleStudySuggestion}
      onCreateQuizFromSuggestion={actions.handleCreateQuizFromSuggestion}
      consumedSuggestionKeys={actions.consumedSuggestionKeys}
      nextSteps={nextSteps.items}
      nextStepsLoading={nextSteps.loading}
      nextStepsError={nextSteps.error}
      onRefreshNextSteps={nextSteps.load}
      onNavigateNextStep={switchTab}
      memorySummary={dashboard.summary}
      recentQuestions={dashboard.recentQuestions || []}
      memoryUpdatedAt={dashboard.updatedAt}
      studentId={studentId}
      courseId={courseId}
      classId={dashboard.classId || classId}
      triggerToast={triggerToast}
    />
  );
}

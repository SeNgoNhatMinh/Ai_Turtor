import { useMemo, useState } from 'react';
import { Alert, Button, Space } from 'antd';
import {
  BookOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import AsyncState from '../../components/common/AsyncState';
import { uiCopy } from '../../constants/uiCopy';
import CourseMemorySection from '../../features/student/learning/CourseMemorySection';
import EditLearningMemoryModal from '../../features/student/learning/EditLearningMemoryModal';
import ImprovePlansSection from '../../features/student/learning/ImprovePlansSection';
import LearningOverview from '../../features/student/learning/LearningOverview';
import LearningActionPlan from '../../features/student/learning/LearningActionPlan';
import StudySuggestionsSection from '../../features/student/learning/StudySuggestionsSection';
import { useImprovePlans } from '../../features/student/learning/useImprovePlans';
import {
  formatLearningDateTime,
  getMasteryStatus,
  getSuggestionText,
  makePinnedSuggestionItem,
  normalizeSuggestionKey,
} from '../../features/student/learning/learningProgressUtils';
import './LearningProgress.css';

const STAT_META = {
  activeCourses: { label: 'Active courses', description: 'Courses currently tracked', icon: <BookOutlined /> },
  totalAssignments: { label: 'Assignments', description: 'Tasks in this course context', icon: <FileTextOutlined /> },
  submittedTasks: { label: 'Submitted', description: 'Assignments already submitted', icon: <CheckCircleOutlined /> },
  supportRequests: { label: 'Support requests', description: 'Questions escalated to mentors', icon: <InfoCircleOutlined /> },
};

function LearningProgress({
  learnedTopics,
  weakTopics,
  suggestions,
  isSuggesting,
  refreshSuggestions,
  isLoading = false,
  dashboardStats = {},
  onRefreshDashboard,
  onUpdateMemory,
  pinnedSuggestions = [],
  onPinSuggestion,
  onUnpinSuggestion,
  onStudySuggestion,
  onCreateQuizFromSuggestion,
  memorySummary = '',
  recentQuestions = [],
  memoryUpdatedAt = '',
  studentId = '',
  courseId = '',
  classId = '',
  triggerToast,
}) {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [newLearnedText, setNewLearnedText] = useState('');
  const [newWeakText, setNewWeakText] = useState('');
  const [savingMemory, setSavingMemory] = useState(false);

  const safeLearnedTopics = useMemo(() => (Array.isArray(learnedTopics) ? learnedTopics : []), [learnedTopics]);
  const safeWeakTopics = useMemo(() => (Array.isArray(weakTopics) ? weakTopics : []), [weakTopics]);
  const safeSuggestions = useMemo(() => (Array.isArray(suggestions) ? suggestions : []), [suggestions]);
  const safePinnedSuggestions = useMemo(() => (Array.isArray(pinnedSuggestions) ? pinnedSuggestions : []), [pinnedSuggestions]);
  const safeRecentQuestions = useMemo(() => (
    Array.isArray(recentQuestions) ? recentQuestions.filter(Boolean).slice(-5).reverse() : []
  ), [recentQuestions]);
  const hasContext = Boolean(studentId && courseId);

  const totalTopics = safeLearnedTopics.length + safeWeakTopics.length;
  const masteryRate = totalTopics > 0 ? Math.round((safeLearnedTopics.length / totalTopics) * 100) : 0;
  const masteryStatus = getMasteryStatus(masteryRate);
  const formattedMemoryTime = formatLearningDateTime(memoryUpdatedAt);

  const statEntries = useMemo(() => (
    Object.entries(dashboardStats || {})
      .filter(([, value]) => value != null && value !== '')
      .map(([key, value]) => ({
        key,
        value,
        ...(STAT_META[key] || {
          label: key.replace(/([A-Z])/g, ' $1').trim(),
          description: 'Learning metric',
          icon: <ThunderboltOutlined />,
        }),
      }))
  ), [dashboardStats]);

  const pinnedSet = useMemo(() => (
    new Set(safePinnedSuggestions.map((item) => normalizeSuggestionKey(item)))
  ), [safePinnedSuggestions]);

  const orderedSuggestions = useMemo(() => {
    const suggestionMap = new Map();
    safeSuggestions.forEach((suggestion) => {
      const key = normalizeSuggestionKey(getSuggestionText(suggestion));
      if (key && !suggestionMap.has(key)) suggestionMap.set(key, suggestion);
    });
    const pinnedItems = safePinnedSuggestions.map((item) => (
      suggestionMap.get(normalizeSuggestionKey(item)) || makePinnedSuggestionItem(item)
    ));
    const regularItems = safeSuggestions.filter((suggestion) => (
      !pinnedSet.has(normalizeSuggestionKey(getSuggestionText(suggestion)))
    ));
    return [...pinnedItems, ...regularItems];
  }, [pinnedSet, safePinnedSuggestions, safeSuggestions]);

  const topFocusItems = safePinnedSuggestions.length ? safePinnedSuggestions : safeWeakTopics.slice(0, 4);
  const improvePlanController = useImprovePlans({
    studentId,
    courseId,
    triggerToast,
    onRefreshDashboard,
  });

  const handleAnalyzeMemory = async () => {
    if (!hasContext || isSuggesting) return;
    await refreshSuggestions?.();
    await improvePlanController.fetchImprovePlans();
    onRefreshDashboard?.();
  };

  const openEditMemory = () => {
    setNewLearnedText(safeLearnedTopics.join(', '));
    setNewWeakText(safeWeakTopics.join(', '));
    setEditModalVisible(true);
  };

  const closeEditMemory = () => {
    setEditModalVisible(false);
    setNewLearnedText(safeLearnedTopics.join(', '));
    setNewWeakText(safeWeakTopics.join(', '));
  };

  const handleSaveMemory = async () => {
    const learnedList = newLearnedText.split(',').map((item) => item.trim()).filter(Boolean);
    const weakList = newWeakText.split(',').map((item) => item.trim()).filter(Boolean);
    setSavingMemory(true);
    try {
      await onUpdateMemory?.(learnedList, weakList);
      setEditModalVisible(false);
      onRefreshDashboard?.();
    } finally {
      setSavingMemory(false);
    }
  };

  if (isLoading) {
    return (
      <div className="portal-section center-state">
        <AsyncState loading loadingLabel="Loading learning dashboard..." loadingRows={7} />
      </div>
    );
  }

  return (
    <div className="portal-section learning-dashboard">
      <PageHeader
        title={uiCopy.student.progress.title}
        description={uiCopy.student.progress.subtitle}
        actions={(
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={onRefreshDashboard} disabled={!hasContext}>Refresh dashboard</Button>
            <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleAnalyzeMemory} loading={isSuggesting} disabled={!hasContext}>Analyze memory</Button>
          </Space>
        )}
      />

      {!hasContext && (
        <Alert
          type="warning"
          showIcon
          className="learning-alert"
          title="Choose a course first"
          description="Learning progress is scoped by student and course. Select an enrolled course to load memory, suggestions, and quiz plans."
        />
      )}

      <LearningOverview
        courseId={courseId}
        classId={classId}
        formattedMemoryTime={formattedMemoryTime}
        masteryRate={masteryRate}
        masteryStatus={masteryStatus}
        topFocusItems={topFocusItems}
        pinnedSuggestions={safePinnedSuggestions}
        onUnpinSuggestion={onUnpinSuggestion}
        learnedCount={safeLearnedTopics.length}
        weakCount={safeWeakTopics.length}
        statEntries={statEntries}
      />

      <CourseMemorySection
        learnedTopics={safeLearnedTopics}
        weakTopics={safeWeakTopics}
        memorySummary={memorySummary}
        recentQuestions={safeRecentQuestions}
        hasContext={hasContext}
        onEdit={openEditMemory}
      />

      <StudySuggestionsSection
        suggestions={orderedSuggestions}
        pinnedSet={pinnedSet}
        hasContext={hasContext}
        isSuggesting={isSuggesting}
        onAnalyze={handleAnalyzeMemory}
        onStudy={onStudySuggestion}
        onCreateQuiz={onCreateQuizFromSuggestion}
        onPin={onPinSuggestion}
        onUnpin={onUnpinSuggestion}
      />

      <ImprovePlansSection
        plans={improvePlanController.improvePlans}
        latestPlan={improvePlanController.latestPlan}
        loading={improvePlanController.loadingPlans}
        error={improvePlanController.plansError}
        completingPlanId={improvePlanController.completingPlanId}
        hasContext={hasContext}
        onReload={improvePlanController.fetchImprovePlans}
        onComplete={improvePlanController.completePlan}
      />

      <LearningActionPlan
        courseId={courseId}
        learnedTopics={safeLearnedTopics}
        weakTopics={safeWeakTopics}
        suggestions={orderedSuggestions}
        hasContext={hasContext}
        onStudy={onStudySuggestion}
        onCreateQuiz={onCreateQuizFromSuggestion}
      />

      <EditLearningMemoryModal
        open={editModalVisible}
        saving={savingMemory}
        learnedText={newLearnedText}
        weakText={newWeakText}
        onLearnedChange={setNewLearnedText}
        onWeakChange={setNewWeakText}
        onSave={handleSaveMemory}
        onCancel={closeEditMemory}
      />
    </div>
  );
}

export default LearningProgress;

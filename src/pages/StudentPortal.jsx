import { lazy, Suspense } from 'react';
import { useStudentSupport } from '../hooks/useStudentSupport';
import { useStudentChatTabController } from '../features/student/chat/useStudentChatTabController';
import { useStudentLearningActions } from '../features/student/learning/useStudentLearningActions';
import { useStudentMaterialsController } from '../features/student/materials/useStudentMaterialsController';

const LearningProgress = lazy(() => import('./student/LearningProgress'));
const MaterialsAssignments = lazy(() => import('./student/MaterialsAssignments'));
const PracticeQuizzes = lazy(() => import('./student/PracticeQuizzes'));
const StudentChatTab = lazy(() => import('./student/StudentChatTab'));
const StudentSupportTab = lazy(() => import('./student/StudentSupportTab'));

function StudentTabFallback() {
  return <div className="portal-loading">Loading student workspace...</div>;
}

function StudentPortal({
  activeTab,
  switchTab,
  courseId,
  setCourseId,
  classId,
  courseOptions = [],
  classOptions = [],
  isStudentEnrollmentsLoading = false,
  hasLoadedStudentEnrollments = false,
  hasStudentEnrollments = false,
  isDarkMode = false,
  sessions,
  isSessionsLoading = false,
  activeSessionId,
  activeSessionTitle,
  messages,
  activeSessionQuestionCount = 0,
  activeSessionMaxTurnsReached = false,
  turnLimitNotice,
  dismissTurnLimitNotice,
  resetChat,
  handleCreateSession,
  handleSelectSession,
  handleDeleteSession,
  handleRenameSession,
  handleSendQuery,
  handleStopAiGeneration,
  openLearnedSuggestionResponse,
  assignments,
  selectedAssignment,
  setSelectedAssignment,
  handleStudentSubmit,
  onDownloadAssignment,
  suggestions,
  isSuggesting,
  refreshSuggestions,
  userId = '',
  currentUser,
  studentDashboard,
  isStudentDashboardLoading,
  loadStudentDashboard,
  onPinSuggestion,
  onUnpinSuggestion,
  onMarkChatRead,
  onCloseChat,
  onGetChatDetail,
  handleStudentReviewAnswer,
  onUpdateMemory,
  triggerToast,
  courseMaterials = [],
  onDownloadMaterial,
}) {
  const studentDisplayName = studentDashboard?.studentName
    || studentDashboard?.fullName
    || studentDashboard?.name
    || studentDashboard?.email
    || userId;

  const {
    escalations,
    selectedEscalation,
    isEscalationsLoading,
    isEscalationDetailLoading,
    escalationsError,
    escalationDetailError,
    loadEscalations,
    handleSelectEscalation,
    handleEscalationChange,
  } = useStudentSupport({
    activeTab,
    userId: currentUser?.userId || currentUser?.id || userId,
    studentName: studentDisplayName,
    onMarkChatRead,
    onCloseChat,
    onGetChatDetail,
    onConversationResolved: (conversationId) => {
      if (conversationId && conversationId === activeSessionId) {
        handleSelectSession(conversationId, activeSessionTitle || 'AI Tutor Chat');
      }
    },
  });

  const chatController = useStudentChatTabController({
    courseId,
    setCourseId,
    classId,
    courseOptions,
    classOptions,
    sessions,
    activeSessionId,
    messages,
    activeSessionMaxTurnsReached,
    turnLimitNotice,
    dismissTurnLimitNotice,
    resetChat,
    handleSelectSession,
    handleRenameSession,
    handleSendQuery,
    handleStopAiGeneration,
    switchTab,
    userId,
    studentDashboard,
    loadEscalations,
    triggerToast,
  });

  const {
    quizInitialSuggestion,
    handleStudySuggestion,
    handleCreateQuizFromSuggestion,
  } = useStudentLearningActions({
    activeTab,
    userId,
    courseId,
    classId,
    activeSessionId,
    switchTab,
    loadStudentDashboard,
    openLearnedSuggestionResponse,
    sendText: chatController.sendText,
    triggerToast,
  });

  const materialsController = useStudentMaterialsController({
    selectedAssignment,
    handleStudentSubmit,
    onDownloadAssignment,
  });

  if (activeTab === 'student-chat') {
    return (
      <Suspense fallback={<StudentTabFallback />}>
        <StudentChatTab
          isHistoryDrawerOpen={chatController.isHistoryDrawerOpen}
          setIsHistoryDrawerOpen={chatController.setIsHistoryDrawerOpen}
          sessions={sessions}
          isSessionsLoading={isSessionsLoading}
          activeSessionId={activeSessionId}
          activeSessionTitle={activeSessionTitle}
          editingSessionId={chatController.editingSessionId}
          editingSessionTitle={chatController.editingSessionTitle}
          setEditingSessionId={chatController.setEditingSessionId}
          setEditingSessionTitle={chatController.setEditingSessionTitle}
          onCreateSession={handleCreateSession}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onSaveRename={chatController.onSaveRename}
          courseId={courseId}
          onCourseChange={chatController.handleCourseChange}
          classId={classId}
          courseOptions={courseOptions}
          classOptions={classOptions}
          isStudentEnrollmentsLoading={isStudentEnrollmentsLoading}
          hasLoadedStudentEnrollments={hasLoadedStudentEnrollments}
          hasStudentEnrollments={hasStudentEnrollments}
          isDarkMode={isDarkMode}
          messages={messages}
          chatInput={chatController.chatInput}
          setChatInput={chatController.setChatInput}
          onSendQuery={chatController.onSendQuery}
          onStopQuery={chatController.onStopQuery}
          onPromptStarter={chatController.handlePromptStarter}
          onAnswerAction={chatController.handleAnswerAction}
          isAiLoading={chatController.isAiLoading}
          messagesEndRef={chatController.messagesEndRef}
          handleStudentReviewAnswer={handleStudentReviewAnswer}
          userId={userId}
          studentName={studentDisplayName}
          currentUser={currentUser}
          activeSessionQuestionCount={activeSessionQuestionCount}
          activeSessionMaxTurnsReached={activeSessionMaxTurnsReached}
          turnLimitNotice={turnLimitNotice}
          onTurnLimitBack={chatController.handleBackToPreviousChat}
          onDismissTurnLimitNotice={dismissTurnLimitNotice}
          triggerToast={triggerToast}
          courseMaterials={courseMaterials}
          onAnalyzeStudyTip={refreshSuggestions}
          onStudySuggestion={handleStudySuggestion}
          onCreateQuizFromSuggestion={handleCreateQuizFromSuggestion}
          onDownloadSource={chatController.handleDownloadSource}
          onOpenMentorReview={() => switchTab?.('student-escalation')}
        />
      </Suspense>
    );
  }

  if (activeTab === 'student-memory') {
    const learned = Array.isArray(studentDashboard?.learnedTopics) ? studentDashboard.learnedTopics : [];
    const weak = Array.isArray(studentDashboard?.weakTopics) ? studentDashboard.weakTopics : [];
    return (
      <Suspense fallback={<StudentTabFallback />}>
        <LearningProgress
          learnedTopics={learned}
          weakTopics={weak}
          suggestions={suggestions}
          isSuggesting={isSuggesting}
          refreshSuggestions={refreshSuggestions}
          isLoading={isStudentDashboardLoading}
          dashboardStats={studentDashboard?.stats}
          onRefreshDashboard={loadStudentDashboard}
          onUpdateMemory={onUpdateMemory}
          pinnedSuggestions={studentDashboard?.pinnedImproveSuggestions || []}
          onPinSuggestion={onPinSuggestion}
          onUnpinSuggestion={onUnpinSuggestion}
          onStudySuggestion={handleStudySuggestion}
          onCreateQuizFromSuggestion={handleCreateQuizFromSuggestion}
          memorySummary={studentDashboard?.summary}
          recentQuestions={studentDashboard?.recentQuestions || []}
          memoryUpdatedAt={studentDashboard?.updatedAt}
          studentId={userId}
          courseId={courseId}
          classId={studentDashboard?.classId || classId}
          triggerToast={triggerToast}
        />
      </Suspense>
    );
  }

  if (activeTab === 'student-quizzes') {
    return (
      <Suspense fallback={<StudentTabFallback />}>
        <PracticeQuizzes
          studentId={userId}
          courseId={courseId}
          classId={classId}
          suggestions={suggestions}
          initialSuggestion={quizInitialSuggestion}
          triggerToast={triggerToast}
          onAfterQuizSubmit={loadStudentDashboard}
        />
      </Suspense>
    );
  }

  if (activeTab === 'student-materials') {
    return (
      <Suspense fallback={<StudentTabFallback />}>
        <MaterialsAssignments
          assignments={assignments}
          selectedAssignment={selectedAssignment}
          setSelectedAssignment={setSelectedAssignment}
          studentSubmissionFile={materialsController.studentSubmissionFile}
          setStudentSubmissionFile={materialsController.setStudentSubmissionFile}
          studentSubmissionNote={materialsController.studentSubmissionNote}
          setStudentSubmissionNote={materialsController.setStudentSubmissionNote}
          onStudentSubmit={materialsController.onStudentSubmit}
          onDownloadAssignment={materialsController.handleDownloadAssignment}
          courseMaterials={courseMaterials}
          onDownloadMaterial={onDownloadMaterial}
        />
      </Suspense>
    );
  }

  if (activeTab === 'student-escalation') {
    return (
      <Suspense fallback={<StudentTabFallback />}>
        <StudentSupportTab
          escalations={escalations}
          selectedEscalation={selectedEscalation}
          isEscalationsLoading={isEscalationsLoading}
          isEscalationDetailLoading={isEscalationDetailLoading}
          escalationsError={escalationsError}
          escalationDetailError={escalationDetailError}
          loadEscalations={loadEscalations}
          onSelectEscalation={handleSelectEscalation}
          onEscalationChange={handleEscalationChange}
          currentUser={currentUser}
        />
      </Suspense>
    );
  }

  return null;
}

export default StudentPortal;

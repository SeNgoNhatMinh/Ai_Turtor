import LearningProgress from './student/LearningProgress';
import MaterialsAssignments from './student/MaterialsAssignments';
import PracticeQuizzes from './student/PracticeQuizzes';
import StudentChatTab from './student/StudentChatTab';
import StudentSupportTab from './student/StudentSupportTab';
import { useStudentSupport } from '../hooks/useStudentSupport';
import { useStudentChatTabController } from './student/hooks/useStudentChatTabController';
import { useStudentLearningActions } from './student/hooks/useStudentLearningActions';
import { useStudentMaterialsController } from './student/hooks/useStudentMaterialsController';

function StudentPortal({
  activeTab,
  switchTab,
  courseId,
  setCourseId,
  classId,
  setClassId,
  courseOptions = [],
  classOptions = [],
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
  const {
    escalations,
    selectedEscalation,
    escChatMessages,
    escChatInput,
    setEscChatInput,
    escMentors,
    escModalVisible,
    setEscModalVisible,
    selectedMentorForEsc,
    setSelectedMentorForEsc,
    isEscalationsLoading,
    isEscChatSending,
    escalationsError,
    chatUnreadCount,
    chatRoomDetail,
    escMessagesEndRef,
    loadEscalations,
    handleSelectEscalation,
    handleCloseSupportChat,
    onSendEscalationMsg,
    onSelectMentor,
    handleOpenMentorSelect,
  } = useStudentSupport({
    activeTab,
    userId,
    onMarkChatRead,
    onCloseChat,
    onGetChatDetail,
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
        setClassId={setClassId}
        courseOptions={courseOptions}
        classOptions={classOptions}
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
        activeSessionQuestionCount={activeSessionQuestionCount}
        activeSessionMaxTurnsReached={activeSessionMaxTurnsReached}
        turnLimitNotice={turnLimitNotice}
        onTurnLimitBack={chatController.handleBackToPreviousChat}
        onDismissTurnLimitNotice={dismissTurnLimitNotice}
        triggerToast={triggerToast}
        courseMaterials={courseMaterials}
        onAnalyzeStudyTip={refreshSuggestions}
        onDownloadSource={chatController.handleDownloadSource}
      />
    );
  }

  if (activeTab === 'student-memory') {
    const learned = Array.isArray(studentDashboard?.learnedTopics) ? studentDashboard.learnedTopics : [];
    const weak = Array.isArray(studentDashboard?.weakTopics) ? studentDashboard.weakTopics : [];
    return (
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
    );
  }

  if (activeTab === 'student-quizzes') {
    return (
      <PracticeQuizzes
        studentId={userId}
        courseId={courseId}
        classId={classId}
        suggestions={suggestions}
        initialSuggestion={quizInitialSuggestion}
        triggerToast={triggerToast}
        onAfterQuizSubmit={loadStudentDashboard}
      />
    );
  }

  if (activeTab === 'student-materials') {
    return (
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
    );
  }

  if (activeTab === 'student-escalation') {
    return (
      <StudentSupportTab
        escalations={escalations}
        selectedEscalation={selectedEscalation}
        escChatMessages={escChatMessages}
        escChatInput={escChatInput}
        setEscChatInput={setEscChatInput}
        escMessagesEndRef={escMessagesEndRef}
        isEscChatSending={isEscChatSending}
        userId={userId}
        isEscalationsLoading={isEscalationsLoading}
        escalationsError={escalationsError}
        chatUnreadCount={chatUnreadCount}
        chatRoomDetail={chatRoomDetail}
        loadEscalations={loadEscalations}
        onSelectEscalation={handleSelectEscalation}
        onSendEscalationMsg={onSendEscalationMsg}
        onOpenMentorSelect={handleOpenMentorSelect}
        onCloseSupportChat={handleCloseSupportChat}
        escModalVisible={escModalVisible}
        escMentors={escMentors}
        selectedMentorForEsc={selectedMentorForEsc}
        setSelectedMentorForEsc={setSelectedMentorForEsc}
        setEscModalVisible={setEscModalVisible}
        onSelectMentor={onSelectMentor}
      />
    );
  }

  return null;
}

export default StudentPortal;

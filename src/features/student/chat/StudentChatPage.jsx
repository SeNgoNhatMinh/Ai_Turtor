import { useEffect, useRef } from 'react';
import StudentChatTab from '../../../pages/student/StudentChatTab';
import { useCourseMaterialsController } from '../../../hooks/useCourseMaterialsController';
import { useStudentChatController } from '../../../hooks/useStudentChatController';
import { useStudentLearningController } from '../learning/useStudentLearningController';
import { useStudentLearningActions } from '../learning/useStudentLearningActions';
import { clearStudyChatHandoff, readStudyChatHandoff } from '../studentRouteHandoff';
import { useStudentChatTabController } from './useStudentChatTabController';

export default function StudentChatPage({
  currentUser,
  studentId,
  courseId,
  setCourseId,
  classId,
  isDarkMode,
  switchTab,
  triggerToast,
  enrollment,
}) {
  const pendingStudyHandoffRef = useRef(readStudyChatHandoff());
  const learning = useStudentLearningController({
    studentId,
    courseId,
    classId,
    switchTab,
    triggerToast,
  });
  const chat = useStudentChatController({
    currentUser,
    studentId,
    courseId,
    classId,
    triggerToast,
  });
  const materials = useCourseMaterialsController({
    courseId,
    classId,
    teacherId: studentId,
    triggerToast,
  });
  const chatController = useStudentChatTabController({
    courseId,
    setCourseId,
    classId,
    courseOptions: enrollment.courseOptions,
    classOptions: enrollment.classOptions,
    sessions: chat.sessions,
    activeSessionId: chat.activeSessionId,
    messages: chat.messages,
    activeSessionMaxTurnsReached: chat.activeSessionMaxTurnsReached,
    turnLimitNotice: chat.turnLimitNotice,
    dismissTurnLimitNotice: chat.dismissTurnLimitNotice,
    resetChat: chat.resetChat,
    handleSelectSession: chat.handleSelectSession,
    handleRenameSession: chat.handleRenameSession,
    handleSendQuery: chat.handleSendQuery,
    handleStopAiGeneration: chat.handleStopAiGeneration,
    switchTab,
    userId: studentId,
    studentDashboard: learning.studentDashboard,
    triggerToast,
  });
  const learningActions = useStudentLearningActions({
    activeTab: 'student-chat',
    userId: studentId,
    courseId,
    classId,
    activeSessionId: chat.activeSessionId,
    switchTab,
    loadStudentDashboard: learning.loadStudentDashboard,
    openLearnedSuggestionResponse: chat.openLearnedSuggestionResponse,
    sendText: chatController.sendText,
    triggerToast,
  });

  useEffect(() => {
    if (!studentId || !courseId) return;
    chat.loadChatSessions();
    materials.loadCourseMaterials();
    learning.loadStudentDashboard();
    // Route pages load only their own resources when identity/context changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, courseId, classId]);

  useEffect(() => {
    const handoff = pendingStudyHandoffRef.current;
    if (!handoff || !studentId || !courseId || !classId) return;
    pendingStudyHandoffRef.current = null;
    clearStudyChatHandoff();
    if (handoff.response?.conversationId || handoff.response?.answer) {
      chat.openLearnedSuggestionResponse(handoff.response, handoff.suggestionText);
      return;
    }
    if (handoff.prompt) chatController.sendText(handoff.prompt);
    // Consume a route handoff once after enrollment context is available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, courseId, classId]);

  const studentDisplayName = learning.studentDashboard?.studentName
    || learning.studentDashboard?.fullName
    || currentUser?.fullName
    || currentUser?.name
    || studentId;

  return (
    <StudentChatTab
      isHistoryDrawerOpen={chatController.isHistoryDrawerOpen}
      setIsHistoryDrawerOpen={chatController.setIsHistoryDrawerOpen}
      sessions={chat.sessions}
      isSessionsLoading={chat.isSessionsLoading}
      activeSessionId={chat.activeSessionId}
      activeSessionTitle={chat.activeSessionTitle}
      editingSessionId={chatController.editingSessionId}
      editingSessionTitle={chatController.editingSessionTitle}
      setEditingSessionId={chatController.setEditingSessionId}
      setEditingSessionTitle={chatController.setEditingSessionTitle}
      onCreateSession={chat.handleCreateSession}
      onSelectSession={chat.handleSelectSession}
      onDeleteSession={chat.handleDeleteSession}
      onSaveRename={chatController.onSaveRename}
      courseId={courseId}
      onCourseChange={chatController.handleCourseChange}
      classId={classId}
      courseOptions={enrollment.courseOptions}
      classOptions={enrollment.classOptions}
      isStudentEnrollmentsLoading={enrollment.isStudentEnrollmentsLoading}
      hasLoadedStudentEnrollments={enrollment.hasLoadedStudentEnrollments}
      hasStudentEnrollments={enrollment.hasStudentEnrollments}
      isDarkMode={isDarkMode}
      messages={chat.messages}
      chatInput={chatController.chatInput}
      setChatInput={chatController.setChatInput}
      onSendQuery={chatController.onSendQuery}
      onStopQuery={chatController.onStopQuery}
      onPromptStarter={chatController.handlePromptStarter}
      onAnswerAction={chatController.handleAnswerAction}
      isAiLoading={chatController.isAiLoading}
      messagesEndRef={chatController.messagesEndRef}
      handleStudentReviewAnswer={learning.handleStudentReviewAnswer}
      userId={studentId}
      studentName={studentDisplayName}
      currentUser={currentUser}
      activeSessionQuestionCount={chat.activeSessionQuestionCount}
      activeSessionMaxTurnsReached={chat.activeSessionMaxTurnsReached}
      turnLimitNotice={chat.turnLimitNotice}
      onTurnLimitBack={chatController.handleBackToPreviousChat}
      onDismissTurnLimitNotice={chat.dismissTurnLimitNotice}
      triggerToast={triggerToast}
      courseMaterials={materials.courseMaterials}
      onAnalyzeStudyTip={learning.refreshSuggestions}
      onStudySuggestion={learningActions.handleStudySuggestion}
      onCreateQuizFromSuggestion={learningActions.handleCreateQuizFromSuggestion}
      onDownloadSource={chatController.handleDownloadSource}
      onOpenMentorReview={() => switchTab?.('student-escalation')}
    />
  );
}

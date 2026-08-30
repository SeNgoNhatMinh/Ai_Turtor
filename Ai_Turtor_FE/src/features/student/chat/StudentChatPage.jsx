import { useEffect, useRef } from 'react';
import StudentChatView from './StudentChatView';
import { useCourseMaterialsController } from '../../../hooks/useCourseMaterialsController';
import { useStudentChatController } from '../../../hooks/useStudentChatController';
import { useStudentLearningController } from '../learning/useStudentLearningController';
import { useStudentLearningActions } from '../learning/useStudentLearningActions';
import { clearStudyChatHandoff, readStudyChatHandoff } from '../studentRouteHandoff';
import { classIdMatches } from '../../../utils/academicIds';
import { useChatMentorRequests } from './useChatMentorRequests';
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
  const {
    classOptions,
    courseOptions,
    ensureEnrollmentContext,
    hasLoadedStudentEnrollments,
    hasStudentEnrollments,
    isStudentEnrollmentsLoading,
    selectCourse,
  } = enrollment;
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
  const mentorRequests = useChatMentorRequests({
    userId: studentId,
    courseId,
  });
  const chatController = useStudentChatTabController({
    courseId,
    setCourseId: selectCourse || setCourseId,
    classId,
    courseOptions,
    classOptions,
    sessions: chat.sessions,
    activeSessionId: chat.activeSessionId,
    messages: chat.messages,
    activeSessionMaxTurnsReached: chat.activeSessionMaxTurnsReached,
    courseDailyQuotaExhausted: chat.courseDailyQuotaExhausted,
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
    courseId,
    switchTab,
    loadStudentDashboard: learning.loadStudentDashboard,
    setChatDraft: chatController.setChatDraft,
    sendChatMessage: chatController.sendText,
    triggerToast,
  });

  useEffect(() => {
    if (
      !studentId
      || isStudentEnrollmentsLoading
      || !hasLoadedStudentEnrollments
      || (hasLoadedStudentEnrollments && !hasStudentEnrollments)
    ) return;

    const normalizedCourseId = String(courseId || '').trim().toUpperCase();
    const hasValidCourse = courseOptions.some((item) => (
      String(item?.value || '').trim().toUpperCase() === normalizedCourseId
    ));
    const hasValidClass = classOptions.some((item) => (
      classIdMatches(item?.value, classId)
      || item?.aliases?.some((alias) => classIdMatches(alias, classId))
    ));
    if (hasValidCourse && hasValidClass) return;

    ensureEnrollmentContext?.(courseId);
  }, [
    classId,
    courseId,
    classOptions,
    courseOptions,
    ensureEnrollmentContext,
    hasLoadedStudentEnrollments,
    hasStudentEnrollments,
    isStudentEnrollmentsLoading,
    studentId,
  ]);

  useEffect(() => {
    if (!studentId || !courseId) return;

    chat.openTutorSession();

    const materialsTimer = window.setTimeout(() => {
      materials.loadCourseMaterials();
    }, 100);

    let dashboardCancel = null;
    const loadDashboard = () => learning.loadStudentDashboard();
    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(loadDashboard, { timeout: 3000 });
      dashboardCancel = () => window.cancelIdleCallback(idleId);
    } else {
      const dashboardTimer = window.setTimeout(loadDashboard, 1200);
      dashboardCancel = () => window.clearTimeout(dashboardTimer);
    }

    return () => {
      window.clearTimeout(materialsTimer);
      dashboardCancel?.();
    };
    // Route pages load only their own resources when identity/context changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, courseId, classId]);

  useEffect(() => {
    const handoff = pendingStudyHandoffRef.current;
    if (!handoff || !studentId || !courseId || !classId) return;
    pendingStudyHandoffRef.current = null;
    clearStudyChatHandoff();
    if (handoff.prompt) {
      chatController.setChatDraft(handoff.prompt);
      triggerToast?.('Đã đưa gợi ý vào khung chat. Bạn có thể chỉnh sửa trước khi gửi.');
    }
    // Consume a route handoff once after enrollment context is available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, courseId, classId]);

  const studentDisplayName = learning.studentDashboard?.studentName
    || learning.studentDashboard?.fullName
    || currentUser?.fullName
    || currentUser?.name
    || studentId;

  return (
    <StudentChatView
      isHistoryDrawerOpen={chatController.isHistoryDrawerOpen}
      setIsHistoryDrawerOpen={chatController.setIsHistoryDrawerOpen}
      sessions={chat.sessions}
      isSessionsLoading={chat.isSessionsLoading}
      sessionMutationKey={chat.sessionMutationKey}
      isCreatingSession={chat.isCreatingSession}
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
      courseOptions={courseOptions}
      classOptions={classOptions}
      isStudentEnrollmentsLoading={isStudentEnrollmentsLoading}
      hasLoadedStudentEnrollments={hasLoadedStudentEnrollments}
      hasStudentEnrollments={hasStudentEnrollments}
      isDarkMode={isDarkMode}
      messages={chat.messages}
      chatInput={chatController.chatInput}
      setChatInput={chatController.setChatInput}
      onSendQuery={chatController.onSendQuery}
      onResendMessage={chatController.sendText}
      onStopQuery={chatController.onStopQuery}
      onPromptStarter={chatController.handlePromptStarter}
      onCheckUnderstanding={chat.handleCheckUnderstanding}
      onAnswerAction={chatController.handleAnswerAction}
      isAiLoading={chatController.isAiLoading}
      messagesEndRef={chatController.messagesEndRef}
      handleStudentReviewAnswer={learning.handleStudentReviewAnswer}
      userId={studentId}
      studentName={studentDisplayName}
      currentUser={currentUser}
      activeSessionQuestionCount={chat.activeSessionQuestionCount}
      activeSessionMaxTurnsReached={chat.activeSessionMaxTurnsReached}
      courseDailyQuota={chat.courseDailyQuota}
      courseDailyQuotaExhausted={chat.courseDailyQuotaExhausted}
      turnLimitNotice={chat.turnLimitNotice}
      onTurnLimitBack={chatController.handleBackToPreviousChat}
      onDismissTurnLimitNotice={chat.dismissTurnLimitNotice}
      triggerToast={triggerToast}
      courseMaterials={materials.courseMaterials}
      mentorRequests={mentorRequests.mentorRequests}
      onStudySuggestion={learningActions.handleStudySuggestion}
      onCreateQuizFromSuggestion={learningActions.handleCreateQuizFromSuggestion}
      onDownloadSource={chatController.handleDownloadSource}
      onOpenMentorReview={() => switchTab?.('student-escalation')}
      onMentorRequestCreated={mentorRequests.refreshMentorRequests}
      tutorSession={chat.activeTutorSession}
      tutorSessionSummary={chat.tutorSessionSummary}
      isTutorSessionLoading={chat.isTutorSessionLoading}
      onStartNextTutorSession={chat.openTutorSession}
    />
  );
}

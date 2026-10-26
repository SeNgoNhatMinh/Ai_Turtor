import { useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { queryKeys } from '../../../app/queryKeys';
import { adminAcademicApi } from '../../../services/adminAcademicApi';
import { getStudentSupportPath } from '../../../app/routes';
import StudentChatView from './StudentChatView';
import { useCourseMaterialsController } from '../../../hooks/useCourseMaterialsController';
import { useStudentChatController } from '../../../hooks/useStudentChatController';
import { useStudentLearningController } from '../learning/useStudentLearningController';
import { useStudentLearningActions } from '../learning/useStudentLearningActions';
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
  const navigate = useNavigate();
  const openMentorReview = useCallback((escalationId) => {
    navigate(getStudentSupportPath(escalationId));
  }, [navigate]);
  const {
    classOptions,
    courseOptions,
    ensureEnrollmentContext,
    hasLoadedStudentEnrollments,
    hasStudentEnrollments,
    isStudentEnrollmentsLoading,
    selectCourse,
  } = enrollment;
  const learning = useStudentLearningController({
    studentId,
    courseId,
    classId,
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
    studentId,
    triggerToast,
    skipUnauthorizedRedirect: true,
  });
  const mentorRequests = useChatMentorRequests({
    userId: currentUser?.userId || currentUser?.id || studentId,
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
    handleLockUnderstandingAnswer: chat.handleLockUnderstandingAnswer,
    handleStopAiGeneration: chat.handleStopAiGeneration,
    switchTab,
    onOpenMentorReview: openMentorReview,
    userId: studentId || currentUser?.userId || currentUser?.id,
    studentDashboard: learning.studentDashboard,
    triggerToast,
  });
  const learningActions = useStudentLearningActions({
    switchTab,
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

  // Default screen of a course chat: the curriculum overview (with its
  // starter suggestions) instead of a generic "what do you want to learn".
  const curriculumQuery = useQuery({
    queryKey: queryKeys.studentLearningGuide(courseId),
    queryFn: () => adminAcademicApi.getStudentLearningGuide(courseId),
    enabled: Boolean(courseId),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const curriculumWelcome = String(curriculumQuery.data?.welcomeMarkdown || '').trim();
  const displayMessages = useMemo(() => {
    if (!curriculumWelcome || chat.isMessagesLoading) return chat.messages;
    // An opened conversation with history shows only its own messages; an
    // empty one (or the new-chat screen) opens on the curriculum overview.
    if (chat.activeSessionId && chat.messages.length > 0) return chat.messages;
    return [{
      id: `curriculum-${courseId}`,
      question: '',
      answer: curriculumWelcome,
      proactive: true,
      mode: 'RAG',
    }, ...chat.messages];
  }, [chat.activeSessionId, chat.isMessagesLoading, chat.messages, courseId, curriculumWelcome]);

  // No background tutor-session bootstrap: opening a tutor session (which
  // auto-creates "Buổi học cùng AI Tutor" conversations) happens only when
  // the student explicitly starts one via "Hỏi AI Tutor".

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
      messages={displayMessages}
      isMessagesLoading={chat.isMessagesLoading}
      chatInput={chatController.chatInput}
      setChatInput={chatController.setChatInput}
      chatMode={chatController.chatMode}
      setChatMode={chatController.setChatMode}
      onSendQuery={chatController.onSendQuery}
      onResendMessage={chatController.sendText}
      onStopQuery={chatController.onStopQuery}
      onLockUnderstandingAnswer={chatController.handleUnderstandingCheckAnswer}
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
      onOpenMentorReview={openMentorReview}
      onMentorRequestCreated={mentorRequests.refreshMentorRequests}
      tutorSession={chat.activeTutorSession}
      supportLevel={chat.studentSupportLevel}
      tutorSessionSummary={chat.tutorSessionSummary}
      isTutorSessionLoading={chat.isTutorSessionLoading}
      onStartNextTutorSession={chat.openTutorSession}
    />
  );
}

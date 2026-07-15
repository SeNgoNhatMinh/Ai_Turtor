import { useEffect, useMemo } from 'react';
import StudentPortal from '../../pages/StudentPortal';
import { useStudentLearningController } from '../../features/student/learning/useStudentLearningController';
import { useStudentEnrollmentOptions } from '../../hooks/useStudentEnrollmentOptions';
import { useStudentChatController } from '../../hooks/useStudentChatController';
import { useCodeMentorController } from '../../hooks/useCodeMentorController';
import { useStudentAssignmentsController } from '../../hooks/useStudentAssignmentsController';
import { useCourseMaterialsController } from '../../hooks/useCourseMaterialsController';

export default function StudentWorkspace({
  currentUser,
  activeTab,
  switchTab,
  courseId,
  setCourseId,
  classId,
  setClassId,
  isDarkMode,
  triggerToast,
}) {
  const currentUserId = currentUser?.userId || currentUser?.id || '';
  const studentLookupIds = useMemo(() => [
    currentUser?.studentId,
    currentUser?.studentCode,
    currentUser?.email,
    currentUser?._id,
  ], [currentUser]);

  const enrollments = useStudentEnrollmentOptions({
    studentId: currentUserId,
    lookupIds: studentLookupIds,
    courseId,
    classId,
    setCourseId,
    setClassId,
  });
  const studentId = enrollments.resolvedStudentId || currentUserId;

  const learning = useStudentLearningController({
    studentId,
    courseId,
    classId,
    switchTab,
    triggerToast,
  });
  const codeMentor = useCodeMentorController({
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
    setCodeMentorDiagnostics: codeMentor.setCodeMentorDiagnostics,
  });
  const assignments = useStudentAssignmentsController({ studentId, triggerToast });
  const materials = useCourseMaterialsController({
    courseId,
    classId,
    teacherId: currentUserId,
    triggerToast,
  });

  useEffect(() => {
    if (!currentUserId) return;
    enrollments.loadStudentEnrollments();
    chat.loadChatSessions();
    assignments.loadStudentAssignments();
    materials.loadCourseMaterials();
    // Legacy loaders are migrated one controller at a time and are not callback-stable yet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, courseId, classId, studentId]);

  return (
    <StudentPortal
      activeTab={activeTab}
      switchTab={switchTab}
      courseId={courseId}
      setCourseId={setCourseId}
      classId={classId}
      courseOptions={enrollments.courseOptions}
      classOptions={enrollments.classOptions}
      isStudentEnrollmentsLoading={enrollments.isStudentEnrollmentsLoading}
      hasLoadedStudentEnrollments={enrollments.hasLoadedStudentEnrollments}
      hasStudentEnrollments={enrollments.hasStudentEnrollments}
      isDarkMode={isDarkMode}
      sessions={chat.sessions}
      isSessionsLoading={chat.isSessionsLoading}
      activeSessionId={chat.activeSessionId}
      activeSessionTitle={chat.activeSessionTitle}
      messages={chat.messages}
      activeSessionQuestionCount={chat.activeSessionQuestionCount}
      activeSessionMaxTurnsReached={chat.activeSessionMaxTurnsReached}
      turnLimitNotice={chat.turnLimitNotice}
      dismissTurnLimitNotice={chat.dismissTurnLimitNotice}
      resetChat={chat.resetChat}
      handleCreateSession={chat.handleCreateSession}
      handleSelectSession={chat.handleSelectSession}
      handleDeleteSession={chat.handleDeleteSession}
      handleRenameSession={chat.handleRenameSession}
      handleSendQuery={chat.handleSendQuery}
      handleStopAiGeneration={chat.handleStopAiGeneration}
      openLearnedSuggestionResponse={chat.openLearnedSuggestionResponse}
      assignments={assignments.assignments}
      selectedAssignment={assignments.selectedAssignment}
      setSelectedAssignment={assignments.setSelectedAssignment}
      handleStudentSubmit={assignments.handleStudentSubmit}
      onDownloadAssignment={assignments.handleDownloadAssignment}
      suggestions={learning.suggestions}
      isSuggesting={learning.isSuggesting}
      refreshSuggestions={learning.refreshSuggestions}
      triggerToast={triggerToast}
      userId={studentId}
      currentUser={currentUser}
      studentDashboard={learning.studentDashboard}
      isStudentDashboardLoading={learning.isStudentDashboardLoading}
      loadStudentDashboard={learning.loadStudentDashboard}
      onPinSuggestion={learning.handlePinImproveSuggestion}
      onUnpinSuggestion={learning.handleUnpinImproveSuggestion}
      handleStudentReviewAnswer={learning.handleStudentReviewAnswer}
      onUpdateMemory={learning.handleStudentUpdateMemory}
      courseMaterials={materials.courseMaterials}
      onDownloadMaterial={materials.handleDownloadMaterial}
    />
  );
}

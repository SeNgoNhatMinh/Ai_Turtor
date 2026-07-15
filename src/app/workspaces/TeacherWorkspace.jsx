import { useEffect } from 'react';
import TeacherPortal from '../../pages/TeacherPortal';
import { useTeacherRuntimeController } from '../../hooks/useTeacherRuntimeController';
import { useCourseMaterialsController } from '../../hooks/useCourseMaterialsController';

export default function TeacherWorkspace({
  currentUser,
  activeTab,
  courseId,
  classId,
  setClassId,
  triggerToast,
}) {
  const teacherId = currentUser?.userId || currentUser?.id || '';
  const runtime = useTeacherRuntimeController({
    currentUser,
    activeRole: 'teacher',
    courseId,
    classId,
    triggerToast,
  });
  const materials = useCourseMaterialsController({
    courseId,
    classId,
    teacherId,
    triggerToast,
  });

  useEffect(() => {
    if (!teacherId) return;
    if (activeTab === 'teacher-classes') runtime.loadTeacherDashboard();
    if (activeTab === 'teacher-grading') runtime.loadTeacherSubmissions();
    if (activeTab === 'teacher-escalations') {
      runtime.loadTeacherInbox();
      runtime.loadAnswerReviews();
      runtime.loadKnowledgeCandidates();
    }
    if (activeTab === 'teacher-materials') materials.loadCourseMaterials();
    // Runtime loader callbacks will become stable as each teacher feature is extracted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, teacherId, courseId, classId]);

  return (
    <TeacherPortal
      activeTab={activeTab}
      courseId={courseId}
      classId={classId}
      setClassId={setClassId}
      classesList={runtime.classesList}
      teacherStudents={runtime.teacherStudents}
      teacherSubmissions={runtime.teacherSubmissions}
      quizSubmissions={runtime.quizSubmissions}
      setQuizSubmissions={runtime.setQuizSubmissions}
      selectedTeacherSub={runtime.selectedTeacherSub}
      setSelectedTeacherSub={runtime.setSelectedTeacherSub}
      escalations={runtime.escalations}
      selectedEscalation={runtime.selectedEscalation}
      setSelectedEscalation={runtime.setSelectedEscalation}
      candidates={runtime.candidates}
      answerReviews={runtime.answerReviews}
      seniorAnswerReviews={runtime.seniorAnswerReviews}
      pendingCandidateActionIds={runtime.pendingCandidateActionIds}
      pendingSeniorReviewIds={runtime.pendingSeniorReviewIds}
      isTeacherInboxLoading={runtime.isTeacherInboxLoading}
      teacherTopicHeatmap={runtime.teacherTopicHeatmap}
      teacherDashboardLoading={runtime.teacherDashboardLoading}
      teacherUserId={teacherId}
      loadTeacherInbox={runtime.loadTeacherInbox}
      loadTeacherDashboard={runtime.loadTeacherDashboard}
      loadAnswerReviews={runtime.loadAnswerReviews}
      handleTeacherGradeSubmit={runtime.handleTeacherGradeSubmit}
      handleTeacherAnswerEsc={runtime.handleTeacherAnswerEsc}
      handleApproveCandidate={runtime.handleApproveCandidate}
      handleRejectCandidate={runtime.handleRejectCandidate}
      handleTeacherQuizReview={runtime.handleTeacherQuizReview}
      handleMentorReviewAnswer={runtime.handleMentorReviewAnswer}
      handleSeniorResolveReview={runtime.handleSeniorResolveReview}
      triggerToast={triggerToast}
      courseMaterials={materials.courseMaterials}
      onDownloadMaterial={materials.handleDownloadMaterial}
      currentUserRole={currentUser?.originalRole || currentUser?.role}
      currentUser={currentUser}
    />
  );
}

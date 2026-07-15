import { lazy, Suspense, useEffect, useState } from 'react';
import { API_BASE_URL } from '../services/apiClient';
import { materialsApi } from '../services/materialsApi';
import { useTeacherMaterialsAssignments } from '../hooks/useTeacherMaterialsAssignments';
import { ACADEMIC_CANDIDATE_TYPES } from '../constants/knowledgeFlow';

const QuizAssignments = lazy(() => import('./teacher/QuizAssignments'));
const TeacherClassesTab = lazy(() => import('./teacher/TeacherClassesTab'));
const TeacherMaterialsAssignmentsTab = lazy(() => import('./teacher/TeacherMaterialsAssignmentsTab'));
const TeacherGradingTab = lazy(() => import('./teacher/TeacherGradingTab'));
const TeacherSupportQueueTab = lazy(() => import('./teacher/TeacherSupportQueueTab'));

function TeacherTabFallback() {
  return <div className="portal-loading" role="status">Loading workspace...</div>;
}

function TeacherPortal({
  activeTab,
  courseId,
  classId,
  setClassId,
  classesList,
  teacherStudents,
  teacherSubmissions,
  quizSubmissions,
  setQuizSubmissions,
  selectedTeacherSub,
  setSelectedTeacherSub,
  escalations,
  selectedEscalation,
  setSelectedEscalation,
  candidates,
  answerReviews,
  seniorAnswerReviews,
  pendingCandidateActionIds,
  pendingSeniorReviewIds,
  isTeacherInboxLoading,
  teacherTopicHeatmap,
  teacherDashboardLoading,
  teacherUserId,
  loadTeacherInbox,
  loadTeacherDashboard,
  loadAnswerReviews,
  handleTeacherGradeSubmit,
  handleTeacherAnswerEsc,
  handleApproveCandidate,
  handleRejectCandidate,
  handleTeacherQuizReview,
  handleMentorReviewAnswer,
  handleSeniorResolveReview,
  triggerToast,
  courseMaterials = [],
  onDownloadMaterial,
  onReloadCourseMaterials,
  currentUserRole,
  currentUser,
}) {
  const [teacherGradeScore, setTeacherGradeScore] = useState('');
  const [teacherGradeFeedback, setTeacherGradeFeedback] = useState('');
  const [teacherGradeWeakTopics, setTeacherGradeWeakTopics] = useState([]);

  const [teacherEscReply, setTeacherEscReply] = useState('');
  const [createKnowledgeCandidate, setCreateKnowledgeCandidate] = useState(false);
  const [candidateType, setCandidateType] = useState('ACADEMIC_KNOWLEDGE');
  const [candidateNotes, setCandidateNotes] = useState({});

  const materialsAssignments = useTeacherMaterialsAssignments({
    courseId,
    classId,
    teacherUserId,
    onReloadCourseMaterials,
    triggerToast,
  });

  const handleNoteChange = (candId, value) => {
    setCandidateNotes((prev) => ({ ...prev, [candId]: value }));
  };

  useEffect(() => {
    if (activeTab === 'teacher-materials') {
      materialsAssignments.loadClassAssignments();
    }
    // The workspace owns role-level loading; this portal only owns its local assignment hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, courseId, classId, teacherUserId]);

  const onGradeSubmit = (event) => {
    event.preventDefault();
    handleTeacherGradeSubmit(selectedTeacherSub.id, teacherGradeScore, teacherGradeFeedback, teacherGradeWeakTopics).then(() => {
      setTeacherGradeScore('');
      setTeacherGradeFeedback('');
      setTeacherGradeWeakTopics([]);
    });
  };

  const onAnswerEsc = (event) => {
    event.preventDefault();
    if (!teacherEscReply.trim()) return;
    const nextCandidateType = createKnowledgeCandidate && ACADEMIC_CANDIDATE_TYPES.has(candidateType)
      ? candidateType
      : 'ACADEMIC_KNOWLEDGE';
    handleTeacherAnswerEsc(
      selectedEscalation.id,
      teacherEscReply,
      createKnowledgeCandidate,
      nextCandidateType,
    ).then(() => {
      setTeacherEscReply('');
      setCreateKnowledgeCandidate(false);
    });
  };

  const dashboardHeatmap = teacherTopicHeatmap || [];
  const heatmapNodes = dashboardHeatmap.length
    ? dashboardHeatmap
    : [
        { label: 'JPA Relations (Weak)', level: 'high' },
        { label: 'Spring Security (Warning)', level: 'med' },
        { label: 'REST APIs (Strong)', level: 'none' },
      ];

  return (
    <Suspense fallback={<TeacherTabFallback />}>
      {activeTab === 'teacher-classes' && (
        <TeacherClassesTab
          courseId={courseId}
          classId={classId}
          setClassId={setClassId}
          classesList={classesList}
          teacherStudents={teacherStudents}
          teacherDashboardLoading={teacherDashboardLoading}
          loadTeacherDashboard={loadTeacherDashboard}
          heatmapNodes={heatmapNodes}
          triggerToast={triggerToast}
        />
      )}

      {activeTab === 'teacher-quizzes' && (
        <QuizAssignments
          teacherId={teacherUserId}
          teacherName={currentUser?.fullName || currentUser?.name || ''}
          courseId={courseId}
          classId={classId}
          teacherStudents={teacherStudents}
          triggerToast={triggerToast}
        />
      )}

      {activeTab === 'teacher-materials' && (
        <TeacherMaterialsAssignmentsTab
          {...materialsAssignments}
          classId={classId}
          classesList={classesList}
          courseMaterials={courseMaterials}
          onReloadCourseMaterials={onReloadCourseMaterials}
          onDownloadMaterial={onDownloadMaterial}
          materialApi={materialsApi}
          triggerToast={triggerToast}
          currentUser={currentUser}
          courseId={courseId}
        />
      )}

      {activeTab === 'teacher-grading' && (
        <TeacherGradingTab
          teacherSubmissions={teacherSubmissions}
          quizSubmissions={quizSubmissions}
          setQuizSubmissions={setQuizSubmissions}
          selectedTeacherSub={selectedTeacherSub}
          setSelectedTeacherSub={setSelectedTeacherSub}
          teacherGradeScore={teacherGradeScore}
          setTeacherGradeScore={setTeacherGradeScore}
          teacherGradeFeedback={teacherGradeFeedback}
          setTeacherGradeFeedback={setTeacherGradeFeedback}
          teacherGradeWeakTopics={teacherGradeWeakTopics}
          setTeacherGradeWeakTopics={setTeacherGradeWeakTopics}
          onGradeSubmit={onGradeSubmit}
          handleTeacherQuizReview={handleTeacherQuizReview}
          handleDownloadSubmission={(subId) => window.open(`${API_BASE_URL}/tutor/submissions/${encodeURIComponent(subId)}/file`, '_blank')}
        />
      )}

      {activeTab === 'teacher-escalations' && (
        <TeacherSupportQueueTab
          isTeacherInboxLoading={isTeacherInboxLoading}
          escalations={escalations}
          selectedEscalation={selectedEscalation}
          setSelectedEscalation={setSelectedEscalation}
          loadTeacherInbox={loadTeacherInbox}
          teacherEscReply={teacherEscReply}
          setTeacherEscReply={setTeacherEscReply}
          onAnswerEsc={onAnswerEsc}
          createKnowledgeCandidate={createKnowledgeCandidate}
          setCreateKnowledgeCandidate={setCreateKnowledgeCandidate}
          candidateType={candidateType}
          setCandidateType={setCandidateType}
          answerReviews={answerReviews}
          loadAnswerReviews={loadAnswerReviews}
          handleMentorReviewAnswer={handleMentorReviewAnswer}
          seniorAnswerReviews={seniorAnswerReviews}
          pendingCandidateActionIds={pendingCandidateActionIds}
          pendingSeniorReviewIds={pendingSeniorReviewIds}
          handleSeniorResolveReview={handleSeniorResolveReview}
          candidates={candidates}
          candidateNotes={candidateNotes}
          handleNoteChange={handleNoteChange}
          handleApproveCandidate={handleApproveCandidate}
          handleRejectCandidate={handleRejectCandidate}
          currentUserRole={currentUserRole}
          currentUser={currentUser}
        />
      )}

    </Suspense>
  );
}

export default TeacherPortal;

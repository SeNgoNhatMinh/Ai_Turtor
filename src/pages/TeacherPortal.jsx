import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { useTeacherLiveChat } from '../hooks/useTeacherLiveChat';
import { useTeacherMaterialsAssignments } from '../hooks/useTeacherMaterialsAssignments';
import QuizAssignments from './teacher/QuizAssignments';
import TeacherClassesTab from './teacher/TeacherClassesTab';
import TeacherMaterialsAssignmentsTab from './teacher/TeacherMaterialsAssignmentsTab';
import TeacherGradingTab from './teacher/TeacherGradingTab';
import TeacherSupportQueueTab from './teacher/TeacherSupportQueueTab';
import TeacherLiveChatTab from './teacher/TeacherLiveChatTab';
import { ACADEMIC_CANDIDATE_TYPES } from '../constants/knowledgeFlow';

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
  uploadProgress,
  uploadProgressText,
  escalations,
  selectedEscalation,
  setSelectedEscalation,
  candidates,
  answerReviews,
  seniorAnswerReviews,
  teacherChatInbox,
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
  onMarkChatRead,
  onCloseChat,
  onGetChatDetail,
  onSendChatMessage,
  onGetChatHistory,
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

  const {
    selectedChatEsc,
    teacherChatMessages,
    teacherChatInput,
    setTeacherChatInput,
    chatRoomDetail,
    isTeacherChatSending,
    teacherChatEndRef,
    handleSelectTeacherChat,
    onSendTeacherChat,
    onCloseTeacherChat,
  } = useTeacherLiveChat({
    teacherUserId,
    loadTeacherInbox,
    onMarkChatRead,
    onCloseChat,
    onGetChatDetail,
    onSendChatMessage,
    onGetChatHistory,
    triggerToast,
  });

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
    if (createKnowledgeCandidate && !ACADEMIC_CANDIDATE_TYPES.has(candidateType)) {
      setCandidateType('ACADEMIC_KNOWLEDGE');
    }
  }, [createKnowledgeCandidate, candidateType]);

  useEffect(() => {
    if (activeTab === 'teacher-escalations') {
      loadTeacherInbox?.();
      loadAnswerReviews?.();
    }
    if (activeTab === 'teacher-classes') {
      loadTeacherDashboard?.();
    }
    if (activeTab === 'teacher-chat') {
      loadTeacherInbox?.();
    }
    if (activeTab === 'teacher-materials') {
      materialsAssignments.loadClassAssignments();
    }
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

  const chatInbox = teacherChatInbox?.length ? teacherChatInbox : (escalations || []).filter((item) => item.chatRoomId);

  return (
    <>
      {activeTab === 'teacher-classes' && (
        <TeacherClassesTab
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
          apiService={apiService}
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
          handleDownloadSubmission={(subId) => window.open(`${apiService.getApiBaseUrl()}/tutor/submissions/${subId}/file`, '_blank')}
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
          handleSeniorResolveReview={handleSeniorResolveReview}
          candidates={candidates}
          candidateNotes={candidateNotes}
          handleNoteChange={handleNoteChange}
          handleApproveCandidate={handleApproveCandidate}
          handleRejectCandidate={handleRejectCandidate}
          currentUserRole={currentUserRole}
        />
      )}

      {activeTab === 'teacher-chat' && (
        <TeacherLiveChatTab
          chatInbox={chatInbox}
          selectedChatEsc={selectedChatEsc}
          handleSelectTeacherChat={handleSelectTeacherChat}
          loadTeacherInbox={loadTeacherInbox}
          chatRoomDetail={chatRoomDetail}
          onCloseTeacherChat={onCloseTeacherChat}
          teacherChatMessages={teacherChatMessages}
          teacherUserId={teacherUserId}
          teacherChatEndRef={teacherChatEndRef}
          teacherChatInput={teacherChatInput}
          setTeacherChatInput={setTeacherChatInput}
          isTeacherChatSending={isTeacherChatSending}
          onSendTeacherChat={onSendTeacherChat}
        />
      )}
    </>
  );
}

export default TeacherPortal;

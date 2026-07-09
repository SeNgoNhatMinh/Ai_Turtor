import React, { useEffect, useRef, useState } from 'react';
import { apiService } from '../services/api';
import { getUserFacingError } from '../services/apiClient';
import QuizAssignments from './teacher/QuizAssignments';
import TeacherClassesTab from './teacher/TeacherClassesTab';
import TeacherMaterialsAssignmentsTab from './teacher/TeacherMaterialsAssignmentsTab';
import TeacherGradingTab from './teacher/TeacherGradingTab';
import TeacherSupportQueueTab from './teacher/TeacherSupportQueueTab';
import TeacherLiveChatTab from './teacher/TeacherLiveChatTab';
import { getRecordId, normalizeSupportHistory } from './teacher/teacherPortalUtils';

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
}) {
  const [teacherGradeScore, setTeacherGradeScore] = useState('');
  const [teacherGradeFeedback, setTeacherGradeFeedback] = useState('');
  const [teacherGradeWeakTopics, setTeacherGradeWeakTopics] = useState([]);

  const [teacherEscReply, setTeacherEscReply] = useState('');
  const [createKnowledgeCandidate, setCreateKnowledgeCandidate] = useState(true);
  const [candidateType, setCandidateType] = useState('ACADEMIC_KNOWLEDGE');
  const [candidateClassId, setCandidateClassId] = useState(classId || '');
  const [candidateNotes, setCandidateNotes] = useState({});

  const [newAssignmentTitle, setNewAssignmentTitle] = useState('');
  const [newAssignmentDesc, setNewAssignmentDesc] = useState('');
  const [newAssignmentClass, setNewAssignmentClass] = useState(classId || '');
  const [newAssignmentDeadline, setNewAssignmentDeadline] = useState('');
  const [newAssignmentFile, setNewAssignmentFile] = useState(null);
  const [newAssignmentTargetType, setNewAssignmentTargetType] = useState('ALL_CLASS');
  const [newAssignmentTargetStudents, setNewAssignmentTargetStudents] = useState('');
  const [isPublishingAssignment, setIsPublishingAssignment] = useState(false);
  const [classAssignments, setClassAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  const [selectedChatEsc, setSelectedChatEsc] = useState(null);
  const [teacherChatMessages, setTeacherChatMessages] = useState([]);
  const [teacherChatInput, setTeacherChatInput] = useState('');
  const [chatRoomDetail, setChatRoomDetail] = useState(null);
  const [isTeacherChatSending, setIsTeacherChatSending] = useState(false);
  const teacherChatEndRef = useRef(null);

  const [materialFile, setMaterialFile] = useState(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
  const [materialActionId, setMaterialActionId] = useState('');

  const handleNoteChange = (candId, value) => {
    setCandidateNotes((prev) => ({ ...prev, [candId]: value }));
  };

  useEffect(() => {
    if (classId) {
      setNewAssignmentClass(classId);
    }
    setCandidateClassId(classId || '');
  }, [classId]);

  useEffect(() => {
    teacherChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [teacherChatMessages]);

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
      loadClassAssignments();
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
    handleTeacherAnswerEsc(
      selectedEscalation.id,
      teacherEscReply,
      createKnowledgeCandidate,
      candidateType,
      candidateType === 'OPERATIONAL_POLICY' ? candidateClassId : null,
    ).then(() => {
      setTeacherEscReply('');
    });
  };

  const loadClassAssignments = async () => {
    if (!courseId || !classId || !teacherUserId) {
      setClassAssignments([]);
      return;
    }
    setAssignmentsLoading(true);
    try {
      const data = await apiService.getClassAssignments(courseId, classId, teacherUserId);
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.assignments)
          ? data.assignments
          : Array.isArray(data?.content)
            ? data.content
            : [];
      setClassAssignments(items);
    } catch (error) {
      setClassAssignments([]);
      triggerToast(getUserFacingError(error, 'Unable to load class assignments.'));
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const onCreateAssignment = async (event) => {
    event.preventDefault();
    if (!courseId || !newAssignmentClass || !teacherUserId) {
      triggerToast('Please choose a course and class before publishing.');
      return;
    }
    if (!newAssignmentFile) {
      triggerToast('Please choose an assignment file.');
      return;
    }
    if (newAssignmentTargetType === 'SELECTED_STUDENTS' && !newAssignmentTargetStudents.trim()) {
      triggerToast('Enter selected student IDs, separated by commas.');
      return;
    }

    const formData = new FormData();
    formData.append('file', newAssignmentFile);
    formData.append('teacherId', teacherUserId);
    formData.append('title', newAssignmentTitle.trim());
    formData.append('description', newAssignmentDesc.trim());
    formData.append('targetType', newAssignmentTargetType);
    if (newAssignmentTargetType === 'SELECTED_STUDENTS') {
      formData.append('targetStudentIds', newAssignmentTargetStudents.trim());
    }
    if (newAssignmentDeadline) {
      formData.append('dueAt', new Date(newAssignmentDeadline).toISOString());
    }

    setIsPublishingAssignment(true);
    try {
      await apiService.uploadAssignment(courseId, newAssignmentClass, formData);
      triggerToast('Assignment published.');
      setNewAssignmentTitle('');
      setNewAssignmentDesc('');
      setNewAssignmentDeadline('');
      setNewAssignmentFile(null);
      setNewAssignmentTargetType('ALL_CLASS');
      setNewAssignmentTargetStudents('');
      await loadClassAssignments();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to publish assignment.'));
    } finally {
      setIsPublishingAssignment(false);
    }
  };

  const handleDownloadSubmission = async (submissionId) => {
    triggerToast('Downloading submission file...');
    try {
      const blob = await apiService.downloadSubmissionFile(submissionId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Submission_${submissionId}_File`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      triggerToast('Unable to download the file right now.');
    }
  };

  const handleSelectTeacherChat = async (esc) => {
    setSelectedChatEsc(esc);
    setChatRoomDetail(null);
    if (!esc.chatRoomId) {
      setTeacherChatMessages([]);
      return;
    }
    try {
      if (onMarkChatRead) await onMarkChatRead(esc.chatRoomId);
      if (onGetChatDetail) setChatRoomDetail(await onGetChatDetail(esc.chatRoomId));
      const history = onGetChatHistory ? await onGetChatHistory(esc.chatRoomId) : [];
      setTeacherChatMessages(normalizeSupportHistory(history));
    } catch {
      setTeacherChatMessages([]);
    }
  };

  const onSendTeacherChat = async () => {
    if (!teacherChatInput.trim() || !selectedChatEsc?.chatRoomId || isTeacherChatSending) return;
    const content = teacherChatInput.trim();
    const msgData = {
      chatRoomId: selectedChatEsc.chatRoomId,
      senderId: teacherUserId,
      senderName: teacherUserId,
      senderRole: 'MENTOR',
      content,
    };
    setIsTeacherChatSending(true);
    try {
      await onSendChatMessage(msgData);
      setTeacherChatMessages((prev) => [...prev, { ...msgData, timestamp: new Date().toISOString() }]);
      setTeacherChatInput('');
    } catch {
      triggerToast('Unable to send mentor message.');
    } finally {
      setIsTeacherChatSending(false);
    }
  };

  const onCloseTeacherChat = async () => {
    if (!selectedChatEsc?.chatRoomId || !onCloseChat) return;
    try {
      await onCloseChat({
        chatRoomId: selectedChatEsc.chatRoomId,
        questionEscalationId: selectedChatEsc.id,
      });
      triggerToast('Support chat closed.');
      setTeacherChatMessages([]);
      setSelectedChatEsc(null);
      loadTeacherInbox?.();
    } catch {
      triggerToast('Unable to close chat.');
    }
  };

  const handleTeacherUploadMaterial = async (event) => {
    event.preventDefault();
    if (!materialFile || !courseId || !classId || !teacherUserId) {
      triggerToast('Please choose a course, class, and PDF file first.');
      return;
    }
    const fileName = materialFile.name || '';
    if (!fileName.toLowerCase().endsWith('.pdf')) {
      triggerToast('Only PDF course materials are supported.');
      return;
    }
    setIsUploadingMaterial(true);
    const formData = new FormData();
    formData.append('file', materialFile);
    formData.append('title', materialTitle || materialFile.name);
    formData.append('uploaderRole', 'TEACHER');
    formData.append('teacherId', teacherUserId);
    formData.append('classId', classId);
    try {
      await apiService.uploadMaterial(courseId, formData);
      setMaterialFile(null);
      setMaterialTitle('');
      triggerToast('Class material upload accepted. Indexing is running in the background.');
      await onReloadCourseMaterials?.();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to upload class material.'));
    } finally {
      window.setTimeout(() => setIsUploadingMaterial(false), 2500);
    }
  };

  const handleTeacherMaterialAction = async (action, material) => {
    const materialId = getRecordId(material);
    if (!materialId) {
      triggerToast('This material is missing an ID.');
      return;
    }
    setMaterialActionId(`${action}:${materialId}`);
    try {
      if (action === 'reindex') {
        await apiService.reindexMaterial(courseId, materialId, teacherUserId);
        triggerToast('Material reindexing triggered.');
      }
      if (action === 'delete') {
        await apiService.deleteMaterial(courseId, materialId, teacherUserId);
        triggerToast('Material deleted.');
      }
      await onReloadCourseMaterials?.();
    } catch (error) {
      triggerToast(getUserFacingError(error, action === 'delete' ? 'Unable to delete material.' : 'Unable to reindex material.'));
    } finally {
      setMaterialActionId('');
    }
  };

  const handleDeleteAssignment = async (assignment) => {
    const assignmentId = getRecordId(assignment);
    if (!assignmentId) {
      triggerToast('This assignment is missing an ID.');
      return;
    }
    try {
      await apiService.deleteAssignment(assignmentId, teacherUserId);
      triggerToast('Assignment deleted.');
      await loadClassAssignments();
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to delete assignment. Delete is only allowed before submissions exist.'));
    }
  };

  const handleDownloadAssignmentFile = async (assignment) => {
    const assignmentId = getRecordId(assignment);
    if (!assignmentId) {
      triggerToast('This assignment is missing an ID.');
      return;
    }
    try {
      const blob = await apiService.downloadAssignmentFile(assignmentId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = assignment.attachmentFileName || `assignment-${assignmentId}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to download assignment file.'));
    }
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
          classId={classId}
          classesList={classesList}
          materialTitle={materialTitle}
          setMaterialTitle={setMaterialTitle}
          materialFile={materialFile}
          setMaterialFile={setMaterialFile}
          isUploadingMaterial={isUploadingMaterial}
          handleTeacherUploadMaterial={handleTeacherUploadMaterial}
          newAssignmentTitle={newAssignmentTitle}
          setNewAssignmentTitle={setNewAssignmentTitle}
          newAssignmentDesc={newAssignmentDesc}
          setNewAssignmentDesc={setNewAssignmentDesc}
          newAssignmentClass={newAssignmentClass}
          setNewAssignmentClass={setNewAssignmentClass}
          newAssignmentDeadline={newAssignmentDeadline}
          setNewAssignmentDeadline={setNewAssignmentDeadline}
          newAssignmentFile={newAssignmentFile}
          setNewAssignmentFile={setNewAssignmentFile}
          newAssignmentTargetType={newAssignmentTargetType}
          setNewAssignmentTargetType={setNewAssignmentTargetType}
          newAssignmentTargetStudents={newAssignmentTargetStudents}
          setNewAssignmentTargetStudents={setNewAssignmentTargetStudents}
          isPublishingAssignment={isPublishingAssignment}
          onCreateAssignment={onCreateAssignment}
          classAssignments={classAssignments}
          assignmentsLoading={assignmentsLoading}
          loadClassAssignments={loadClassAssignments}
          handleDownloadAssignmentFile={handleDownloadAssignmentFile}
          handleDeleteAssignment={handleDeleteAssignment}
          courseMaterials={courseMaterials}
          onReloadCourseMaterials={onReloadCourseMaterials}
          onDownloadMaterial={onDownloadMaterial}
          materialActionId={materialActionId}
          handleTeacherMaterialAction={handleTeacherMaterialAction}
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
          candidateClassId={candidateClassId}
          setCandidateClassId={setCandidateClassId}
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

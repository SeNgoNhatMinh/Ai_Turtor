import React, { useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import LearningProgress from './student/LearningProgress';
import MaterialsAssignments from './student/MaterialsAssignments';
import PracticeQuizzes from './student/PracticeQuizzes';
import StudentChatTab from './student/StudentChatTab';
import StudentSupportTab from './student/StudentSupportTab';
import { confirmAction } from '../components/common/confirmDialog';
import { useStudentSupport } from '../hooks/useStudentSupport';
import { apiService } from '../services/api';
import { getUserFacingError } from '../services/apiClient';
import { validateChatInput, validateUploadFile } from '../utils/validators';

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
  codeMentorDiagnostics,
  isCodeAnalyzing,
  handleCodeMentorQuery,
  assignments,
  selectedAssignment,
  setSelectedAssignment,
  handleStudentSubmit,
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
  const [chatInput, setChatInput] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('java');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [avatarEmotion, setAvatarEmotion] = useState('idle');
  const [activeSideTab, setActiveSideTab] = useState('tab-code-review');
  const [studentSubmissionFile, setStudentSubmissionFile] = useState(null);
  const [studentSubmissionNote, setStudentSubmissionNote] = useState('');
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [quizInitialSuggestion, setQuizInitialSuggestion] = useState('');

  const messagesEndRef = useRef(null);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (activeTab === 'student-memory') {
      loadStudentDashboard?.();
    }
  }, [activeTab, courseId]);

  const onSaveRename = (event, sessionId) => {
    event.stopPropagation();
    if (editingSessionTitle.trim()) {
      handleRenameSession(sessionId, editingSessionTitle.trim());
    }
    setEditingSessionId(null);
  };

  const applyCourseChange = (nextCourseId) => {
    if (!nextCourseId || nextCourseId === courseId) return;
    dismissTurnLimitNotice?.();
    resetChat?.();
    setCourseId(nextCourseId);
  };

  const handleCourseChange = (nextCourseId) => {
    if (!nextCourseId || nextCourseId === courseId) return;
    const hasActiveChat = Boolean(activeSessionId) || (Array.isArray(messages) && messages.length > 0);
    if (!hasActiveChat) {
      applyCourseChange(nextCourseId);
      return;
    }

    confirmAction({
      title: 'Switch course?',
      content: "Each course has separate chat history. Switching course will open that course's conversations.",
      okText: 'Switch course',
      cancelText: 'Cancel',
      onOk: () => applyCourseChange(nextCourseId),
    });
  };

  const handleBackToPreviousChat = () => {
    const previousSessionId = turnLimitNotice?.previousSessionId;
    if (!previousSessionId) return;
    const previousSession = sessions.find((session) => session.id === previousSessionId);
    handleSelectSession(previousSessionId, previousSession?.title || 'Previous conversation');
  };

  const sendText = (text) => {
    if (isAiLoading) return;
    if (!userId) {
      triggerToast?.('Please sign in before sending a message.');
      return;
    }
    const hasCourseOptions = Array.isArray(courseOptions) && courseOptions.length > 0;
    const hasValidCourse = !hasCourseOptions || courseOptions.some((item) => item?.value === courseId);
    if (!hasValidCourse) {
      triggerToast?.('Please choose a valid enrolled course before asking AI Tutor.');
      return;
    }
    const hasClassOptions = Array.isArray(classOptions) && classOptions.length > 0;
    const hasValidClass = !hasClassOptions || classOptions.some((item) => item?.value === classId);
    if (!hasValidClass) {
      triggerToast?.('Please choose a valid enrolled class before asking AI Tutor.');
      return;
    }
    if (activeSessionMaxTurnsReached) {
      triggerToast?.('This chat is full. Start a new chat to continue.');
      return;
    }
    const validation = validateChatInput(text);
    if (!validation.ok) {
      triggerToast?.(validation.message);
      return;
    }
    const textToSend = validation.value;
    // Clear input immediately — don't wait for AI response
    setChatInput('');
    setIsAiLoading(true);
    setAvatarEmotion('thinking');
    handleSendQuery(textToSend, codeSnippet, setAvatarEmotion).finally(() => {
      setIsAiLoading(false);
    });
  };

  const handleStudySuggestion = async (suggestionText) => {
    const text = String(suggestionText || '').trim();
    if (!text) return;
    const prompt = `Help me learn this topic step by step from the course materials: ${text}`;
    try {
      triggerToast?.('Preparing a guided study response...');
      const response = await apiService.learnSuggestion(userId, courseId, {
        classId,
        conversationId: activeSessionId || null,
        suggestionText: text,
        topic: text,
      });
      switchTab?.('student-chat');
      if (response?.conversationId || response?.answer) {
        await openLearnedSuggestionResponse?.(response, text);
        triggerToast?.('AI Tutor opened a guided study response for this suggestion.');
      } else {
        sendText(prompt);
      }
    } catch (error) {
      const isAlreadyUsed = error?.status === 409 || error?.details?.error === 'SUGGESTION_ALREADY_USED';
      if (isAlreadyUsed) {
        triggerToast?.('This suggestion was already used in course chat. Choose another suggestion or ask a new question.');
        switchTab?.('student-chat');
        return;
      }
      triggerToast?.(getUserFacingError(error, 'Unable to open this study suggestion. Using chat prompt instead.'));
      switchTab?.('student-chat');
      sendText(prompt);
    }
  };

  const handleCreateQuizFromSuggestion = (suggestionText) => {
    const text = String(suggestionText || '').trim();
    if (!text) return;
    setQuizInitialSuggestion(text);
    switchTab?.('student-quizzes');
  };

  const onSendQuery = () => {
    sendText(chatInput);
  };

  const onStopQuery = () => {
    // Mark AI as done — the in-flight request will still complete but
    // we stop blocking the UI so the user can type again immediately.
    handleStopAiGeneration?.();
    setIsAiLoading(false);
    setAvatarEmotion('idle');
  };

  const handlePromptStarter = (prompt) => {
    setChatInput(prompt);
  };

  const handleAnswerAction = async ({ prompt, type, message }) => {
    if (type === 'retry') {
      const retryText = String(message?.question || prompt || '').trim();
      if (!retryText) {
        triggerToast?.('There is no question to retry.');
        return;
      }
      sendText(retryText);
      return;
    }

    if (type === 'mentor') {
      try {
        await apiService.createEscalation({
          studentId: userId,
          studentName: studentDashboard?.studentName || studentDashboard?.fullName || '',
          studentEmail: studentDashboard?.studentEmail || '',
          courseId,
          classId,
          question: message?.question || prompt,
          aiResponse: message?.rawAnswer || message?.answer || '',
          reason: message?.aiServiceError ? 'AI Tutor could not reach the language model.' : 'Student requested mentor support from AI Tutor chat.',
        });
        triggerToast?.('Support request sent to mentor.');
        loadEscalations();
        switchTab?.('student-escalation');
      } catch (error) {
        triggerToast?.(getUserFacingError(error, 'Unable to create support request.'));
      }
      return;
    }
    sendText(prompt);
  };

  const onCodeReviewQuery = () => {
    if (!codeSnippet.trim()) {
      message.error('Please enter source code or an error log to analyze.');
      return;
    }
    handleCodeMentorQuery(codeSnippet, codeLanguage);
  };

  const onStudentSubmit = () => {
    const fileValidation = validateUploadFile(studentSubmissionFile);
    if (!fileValidation.ok) {
      message.error(fileValidation.message);
      return;
    }
    handleStudentSubmit(selectedAssignment.id, studentSubmissionFile, studentSubmissionNote).then(() => {
      setStudentSubmissionFile(null);
      setStudentSubmissionNote('');
      message.success('Submission uploaded successfully.');
    });
  };

  const handleDownloadAssignment = async (assignmentId) => {
    message.loading({ content: 'Downloading file...', key: 'dl' });
    try {
      const blob = await apiService.downloadAssignmentFile(assignmentId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Assignment_${assignmentId}_File`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      message.success({ content: 'Download completed.', key: 'dl' });
    } catch {
      message.error({ content: 'Unable to download the file.', key: 'dl' });
    }
  };

  const handleDownloadSource = async (materialId, title) => {
    if (!courseId || !materialId) return;
    message.loading({ content: 'Downloading file...', key: 'dl' });
    try {
      const blob = await apiService.downloadMaterialPdf(courseId, materialId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title || 'material'}.pdf`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      message.success({ content: 'Download completed.', key: 'dl' });
    } catch {
      message.error({ content: 'Unable to download the file (it might be a website material).', key: 'dl' });
    }
  };

  if (activeTab === 'student-chat') {
    return (
      <StudentChatTab
        isHistoryDrawerOpen={isHistoryDrawerOpen}
        setIsHistoryDrawerOpen={setIsHistoryDrawerOpen}
        sessions={sessions}
        isSessionsLoading={isSessionsLoading}
        activeSessionId={activeSessionId}
        activeSessionTitle={activeSessionTitle}
        editingSessionId={editingSessionId}
        editingSessionTitle={editingSessionTitle}
        setEditingSessionId={setEditingSessionId}
        setEditingSessionTitle={setEditingSessionTitle}
        onCreateSession={handleCreateSession}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onSaveRename={onSaveRename}
        courseId={courseId}
        onCourseChange={handleCourseChange}
        classId={classId}
        setClassId={setClassId}
        courseOptions={courseOptions}
        classOptions={classOptions}
        isDarkMode={isDarkMode}
        messages={messages}
        chatInput={chatInput}
        setChatInput={setChatInput}
        onSendQuery={onSendQuery}
        onStopQuery={onStopQuery}
        onPromptStarter={handlePromptStarter}
        onAnswerAction={handleAnswerAction}
        isAiLoading={isAiLoading}
        messagesEndRef={messagesEndRef}
        handleStudentReviewAnswer={handleStudentReviewAnswer}
        userId={userId}
        activeSessionQuestionCount={activeSessionQuestionCount}
        activeSessionMaxTurnsReached={activeSessionMaxTurnsReached}
        turnLimitNotice={turnLimitNotice}
        onTurnLimitBack={handleBackToPreviousChat}
        onDismissTurnLimitNotice={dismissTurnLimitNotice}
        triggerToast={triggerToast}
        courseMaterials={courseMaterials}
        onAnalyzeStudyTip={refreshSuggestions}
        onDownloadSource={handleDownloadSource}
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
        studentSubmissionFile={studentSubmissionFile}
        setStudentSubmissionFile={setStudentSubmissionFile}
        studentSubmissionNote={studentSubmissionNote}
        setStudentSubmissionNote={setStudentSubmissionNote}
        onStudentSubmit={onStudentSubmit}
        onDownloadAssignment={handleDownloadAssignment}
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

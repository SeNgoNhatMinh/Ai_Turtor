import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, message } from 'antd';
import { PanelLeft } from 'lucide-react';
import ChatSessionsPanel from './student/ChatSessionsPanel';
import ChatWorkspace from './student/ChatWorkspace';
import LearningProgress from './student/LearningProgress';
import MaterialsAssignments from './student/MaterialsAssignments';
import MentorSupport from './student/MentorSupport';
import MentorSelectModal from './student/MentorSelectModal';
import PracticeQuizzes from './student/PracticeQuizzes';
import PageHeader from '../components/common/PageHeader';
import { uiCopy } from '../constants/uiCopy';
import { normalizeEscalation } from '../services/normalizers';
import { apiService } from '../services/api';
import { getUserFacingError } from '../services/apiClient';
import { validateChatInput, validateUploadFile } from '../utils/validators';

const LIVE_SUPPORT_STATUSES = new Set(['IN_CHAT', 'ASSIGNED', 'ACTIVE']);

const isLiveSupportStatus = (status) => LIVE_SUPPORT_STATUSES.has(String(status || '').toUpperCase());

const getSupportMessageTime = (message) => {
  const value = message?.sentAt || message?.timestamp || message?.createdAt;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

const normalizeSupportHistory = (history) => {
  const list = Array.isArray(history) ? history : [];
  const hasTimestamps = list.some((item) => getSupportMessageTime(item) !== null);
  if (!hasTimestamps) return [...list].reverse();
  return [...list].sort((a, b) => (getSupportMessageTime(a) ?? 0) - (getSupportMessageTime(b) ?? 0));
};

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
  handleCreateSession,
  handleSelectSession,
  handleDeleteSession,
  handleRenameSession,
  handleSendQuery,
  handleStopAiGeneration,
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

  const [escalations, setEscalations] = useState([]);
  const [selectedEscalation, setSelectedEscalation] = useState(null);
  const [escChatMessages, setEscChatMessages] = useState([]);
  const [escChatInput, setEscChatInput] = useState('');
  const [escMentors, setEscMentors] = useState([]);
  const [escModalVisible, setEscModalVisible] = useState(false);
  const [selectedMentorForEsc, setSelectedMentorForEsc] = useState(null);
  const [isEscalationsLoading, setIsEscalationsLoading] = useState(false);
  const [isEscChatSending, setIsEscChatSending] = useState(false);
  const [escalationsError, setEscalationsError] = useState('');
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [chatRoomDetail, setChatRoomDetail] = useState(null);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [quizInitialSuggestion, setQuizInitialSuggestion] = useState('');

  const messagesEndRef = useRef(null);
  const escMessagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    escMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [escChatMessages]);

  const loadChatUnread = async () => {
    try {
      const data = await apiService.getChatUnread(userId);
      setChatUnreadCount(data?.unreadCount ?? data?.count ?? (Array.isArray(data?.rooms) ? data.rooms.length : 0));
    } catch {
      setChatUnreadCount(0);
    }
  };

  const loadEscalations = async () => {
    setIsEscalationsLoading(true);
    setEscalationsError('');
    try {
      const data = await apiService.getEscalationHistory(userId);
      const items = (Array.isArray(data) ? data : []).map(normalizeEscalation);
      setEscalations(items);
      if (selectedEscalation && !items.some((item) => item.id === selectedEscalation.id)) {
        setSelectedEscalation(null);
      }
    } catch (error) {
      setEscalations([]);
      setEscalationsError(getUserFacingError(error, 'Unable to load support requests.'));
    } finally {
      setIsEscalationsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'student-escalation') {
      loadEscalations();
      loadChatUnread();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'student-memory') {
      loadStudentDashboard?.();
    }
  }, [activeTab, courseId]);


  const handleSelectEscalation = async (escalation) => {
    setSelectedEscalation(escalation);
    setChatRoomDetail(null);
    if (isLiveSupportStatus(escalation.status) && escalation.chatRoomId) {
      try {
        if (onMarkChatRead) await onMarkChatRead(escalation.chatRoomId);
        if (onGetChatDetail) {
          const detail = await onGetChatDetail(escalation.chatRoomId);
          setChatRoomDetail(detail);
        }
        loadChatUnread();
      } catch {
        // Non-blocking — chat may still work via history
      }
      const history = await apiService.getChatHistory(escalation.chatRoomId);
      setEscChatMessages(normalizeSupportHistory(history));
    } else {
      setEscChatMessages([]);
    }
  };

  const handleCloseSupportChat = async () => {
    if (!selectedEscalation?.chatRoomId || !onCloseChat) return;
    try {
      await onCloseChat({
        chatRoomId: selectedEscalation.chatRoomId,
        questionEscalationId: selectedEscalation.id,
      });
      message.success('Support chat closed.');
      setEscChatMessages([]);
      setChatRoomDetail(null);
      loadEscalations();
      loadChatUnread();
    } catch (error) {
      message.error(getUserFacingError(error, 'Unable to close chat.'));
    }
  };

  const onSendEscalationMsg = async () => {
    if (!escChatInput.trim() || !selectedEscalation || !isLiveSupportStatus(selectedEscalation.status) || isEscChatSending) return;
    const content = escChatInput.trim();
    const msgData = {
      chatRoomId: selectedEscalation.chatRoomId,
      senderId: userId,
      senderName: userId,
      senderRole: 'USER',
      content,
    };
    setIsEscChatSending(true);
    try {
      await apiService.sendChatMessage(msgData);
      setEscChatMessages((prev) => [...prev, { ...msgData, timestamp: new Date().toISOString() }]);
      setEscChatInput('');
    } catch (error) {
      message.error(getUserFacingError(error, 'Unable to send message.'));
    } finally {
      setIsEscChatSending(false);
    }
  };

  const onSelectMentor = async () => {
    if (!selectedMentorForEsc || !selectedEscalation) return;
    const result = await apiService.selectEscalationMentor({
      questionEscalationId: selectedEscalation.id,
      userId,
      selectedMentorId: selectedMentorForEsc,
    });
    message.success('Mentor selected. Starting support chat...');
    setEscModalVisible(false);
    setSelectedMentorForEsc(null);
    const nextEscalation = {
      ...selectedEscalation,
      status: 'IN_CHAT',
      chatRoomId: result?.chatRoomId || selectedEscalation.chatRoomId,
      assignedMentorName: result?.mentorName || selectedEscalation.assignedMentorName,
      assignedMentorEmail: result?.mentorEmail || selectedEscalation.assignedMentorEmail,
    };
    await handleSelectEscalation(nextEscalation);
    loadEscalations();
  };

  const handleOpenMentorSelect = async (escalation) => {
    setSelectedEscalation(escalation);
    try {
      const offer = await apiService.offerEscalation(escalation.id);
      const suggested = offer?.suggestedMentors || offer?.mentors || [];
      if (Array.isArray(suggested) && suggested.length > 0) {
        setEscMentors(suggested);
      } else {
        const mentors = await apiService.getMentors();
        setEscMentors(Array.isArray(mentors) ? mentors : []);
      }
      setEscModalVisible(true);
    } catch (error) {
      const mentors = await apiService.getMentors();
      setEscMentors(Array.isArray(mentors) ? mentors : []);
      setEscModalVisible(true);
      message.warning(getUserFacingError(error, 'Unable to load suggested mentors. Showing available mentors instead.'));
    }
  };

  const onSaveRename = (event, sessionId) => {
    event.stopPropagation();
    if (editingSessionTitle.trim()) {
      handleRenameSession(sessionId, editingSessionTitle.trim());
    }
    setEditingSessionId(null);
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

  const handleStudySuggestion = (suggestionText) => {
    const text = String(suggestionText || '').trim();
    if (!text) return;
    const prompt = `Help me learn this topic step by step from the course materials: ${text}`;
    switchTab?.('student-chat');
    sendText(prompt);
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
    if (type === 'mentor') {
      try {
        await apiService.createEscalation({
          studentId: userId,
          courseId,
          classId,
          question: message?.question || prompt,
          aiAnswer: message?.answer || '',
          source: 'STUDENT_ACTION_BAR',
        });
        triggerToast?.('Support request sent to mentor.');
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

  if (activeTab === 'student-chat') {
    return (
      <div className="portal-section student-chat-section student-chat-section--minimal">
        <div className="student-chat-layout student-chat-layout--chatgpt">
          <Button
            type="text"
            className="student-chat-history-toggle"
            icon={<PanelLeft size={16} />}
            onClick={() => setIsHistoryDrawerOpen(true)}
          >
            Chat history
          </Button>
          {isHistoryDrawerOpen && (
            <button
              type="button"
              className="student-chat-history-backdrop"
              aria-label="Close chat history"
              onClick={() => setIsHistoryDrawerOpen(false)}
            />
          )}
          <div className={`student-chat-history-pane ${isHistoryDrawerOpen ? 'is-open' : ''}`}>
              <ChatSessionsPanel
                sessions={sessions}
                isLoading={isSessionsLoading}
                activeSessionId={activeSessionId}
                onCreate={() => {
                  handleCreateSession();
                  setIsHistoryDrawerOpen(false);
                }}
                onSelect={(sessionId, title) => {
                  handleSelectSession(sessionId, title);
                  setIsHistoryDrawerOpen(false);
                }}
                onDelete={handleDeleteSession}
                editingSessionId={editingSessionId}
                editingSessionTitle={editingSessionTitle}
                setEditingSessionId={setEditingSessionId}
                setEditingSessionTitle={setEditingSessionTitle}
                onSaveRename={onSaveRename}
                style={{ height: '100%' }}
              />
          </div>
          <div className="student-chat-main-pane">
              <ChatWorkspace
                activeSessionTitle={activeSessionTitle}
                courseId={courseId}
                setCourseId={setCourseId}
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
                style={{ height: '100%' }}
                handleStudentReviewAnswer={handleStudentReviewAnswer}
                userId={userId}
                activeSessionId={activeSessionId}
                triggerToast={triggerToast}
              />
          </div>
        </div>
      </div>
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
        courseId={courseId}
        classId={studentDashboard?.classId || classId}
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
      <>
        <MentorSupport
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
        />
        <MentorSelectModal
          open={escModalVisible}
          mentors={escMentors}
          selectedMentorId={selectedMentorForEsc}
          setSelectedMentorId={setSelectedMentorForEsc}
          escalation={selectedEscalation}
          onCancel={() => setEscModalVisible(false)}
          onOk={onSelectMentor}
        />
      </>
    );
  }

  return null;
}

export default StudentPortal;

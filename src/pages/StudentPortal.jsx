import React, { useEffect, useRef, useState } from 'react';
import { Card, message } from 'antd';
import ChatSessionsPanel from './student/ChatSessionsPanel';
import ChatWorkspace from './student/ChatWorkspace';
import LearningProgress from './student/LearningProgress';
import MaterialsAssignments from './student/MaterialsAssignments';
import MentorSupport from './student/MentorSupport';
import MentorSelectModal from './student/MentorSelectModal';
import PageHeader from '../components/common/PageHeader';
import { uiCopy } from '../constants/uiCopy';
import { normalizeEscalation } from '../services/normalizers';
import { apiService } from '../services/api';
import { validateChatInput, validateUploadFile } from '../utils/validators';

const defaultLearned = ['MVC Flow', 'REST APIs', 'Spring Boot Config', 'Maven Dependencies'];
const defaultWeak = ['JPA Relations', 'Spring Security'];

function StudentPortal({
  activeTab,
  courseId,
  setCourseId,
  classId,
  setClassId,
  isDarkMode = false,
  sessions,
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
  const [escalationsError, setEscalationsError] = useState('');
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [chatRoomDetail, setChatRoomDetail] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1100);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1100);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      setEscalationsError(error.message || 'Unable to load support requests.');
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
    if (escalation.status === 'ASSIGNED' && escalation.chatRoomId) {
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
      setEscChatMessages(Array.isArray(history) ? history : []);
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
      message.error(error.message || 'Unable to close chat.');
    }
  };

  const onSendEscalationMsg = async () => {
    if (!escChatInput.trim() || !selectedEscalation || selectedEscalation.status !== 'ASSIGNED') return;
    const msgData = {
      chatRoomId: selectedEscalation.chatRoomId,
      senderId: userId,
      content: escChatInput,
    };
    await apiService.sendChatMessage(msgData);
    setEscChatMessages((prev) => [...prev, { ...msgData, timestamp: new Date().toISOString() }]);
    setEscChatInput('');
  };

  const onSelectMentor = async () => {
    if (!selectedMentorForEsc || !selectedEscalation) return;
    await apiService.selectEscalationMentor({
      questionEscalationId: selectedEscalation.id,
      userId,
      selectedMentorId: selectedMentorForEsc,
    });
    message.success('Support mentor selected.');
    setEscModalVisible(false);
    setSelectedMentorForEsc(null);
    loadEscalations();
  };

  const handleOpenMentorSelect = async (escalation) => {
    setSelectedEscalation(escalation);
    const mentors = await apiService.getMentors();
    setEscMentors(Array.isArray(mentors) ? mentors : []);
    setEscModalVisible(true);
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
        triggerToast?.(error.message || 'Unable to create support request.');
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
          <div className="student-chat-history-pane">
              <ChatSessionsPanel
                sessions={sessions}
                activeSessionId={activeSessionId}
                onCreate={handleCreateSession}
                onSelect={handleSelectSession}
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
    const learned = studentDashboard?.learnedTopics?.length ? studentDashboard.learnedTopics : defaultLearned;
    const weak = studentDashboard?.weakTopics?.length ? studentDashboard.weakTopics : defaultWeak;
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
          onCancel={() => setEscModalVisible(false)}
          onOk={onSelectMentor}
        />
      </>
    );
  }

  return null;
}

export default StudentPortal;

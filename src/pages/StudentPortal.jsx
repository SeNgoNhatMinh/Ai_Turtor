import React, { useEffect, useRef, useState } from 'react';
import { Card, message, Tabs } from 'antd';
import ChatSessionsPanel from './student/ChatSessionsPanel';
import ChatWorkspace from './student/ChatWorkspace';
import CodeReviewPanel from './student/CodeReviewPanel';
import TutorAvatarPanel from './student/TutorAvatarPanel';
import LearningProgress from './student/LearningProgress';
import MaterialsAssignments from './student/MaterialsAssignments';
import MentorSupport from './student/MentorSupport';
import MentorSelectModal from './student/MentorSelectModal';
import PageHeader from '../components/common/PageHeader';
import { uiCopy } from '../constants/uiCopy';
import { normalizeEscalation } from '../services/normalizers';
import { apiService } from '../services/api';

const learnedTopics = ['MVC Flow', 'REST APIs', 'Spring Boot Config', 'Maven Dependencies'];
const weakTopics = ['JPA Relations', 'Spring Security'];

function StudentPortal({
  activeTab,
  courseId,
  setCourseId,
  classId,
  setClassId,
  sessions,
  activeSessionId,
  activeSessionTitle,
  messages,
  handleCreateSession,
  handleSelectSession,
  handleDeleteSession,
  handleRenameSession,
  handleSendQuery,
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
  userId = 'student-a1',
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

  const [escalations, setEscalations] = useState([]);
  const [selectedEscalation, setSelectedEscalation] = useState(null);
  const [escChatMessages, setEscChatMessages] = useState([]);
  const [escChatInput, setEscChatInput] = useState('');
  const [escMentors, setEscMentors] = useState([]);
  const [escModalVisible, setEscModalVisible] = useState(false);
  const [selectedMentorForEsc, setSelectedMentorForEsc] = useState(null);
  const [isEscalationsLoading, setIsEscalationsLoading] = useState(false);
  const [escalationsError, setEscalationsError] = useState('');

  const messagesEndRef = useRef(null);
  const escMessagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    escMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [escChatMessages]);

  useEffect(() => {
    if (activeTab === 'student-escalation') {
      loadEscalations();
    }
  }, [activeTab]);

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

  const handleSelectEscalation = async (escalation) => {
    setSelectedEscalation(escalation);
    if (escalation.status === 'ASSIGNED') {
      const history = await apiService.getChatHistory(escalation.chatRoomId);
      setEscChatMessages(Array.isArray(history) ? history : []);
    } else {
      setEscChatMessages([]);
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

  const onSendQuery = () => {
    if (!chatInput.trim()) return;
    setAvatarEmotion('thinking');
    handleSendQuery(chatInput, codeSnippet, setAvatarEmotion).then(() => {
      setChatInput('');
    });
  };

  const onCodeReviewQuery = () => {
    if (!codeSnippet.trim()) {
      message.error('Please enter source code or an error log to analyze.');
      return;
    }
    handleCodeMentorQuery(codeSnippet, codeLanguage);
  };

  const onStudentSubmit = () => {
    if (!studentSubmissionFile) {
      message.error('Please choose a submission file first.');
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
      <div className="portal-section student-chat-section">
        <PageHeader title={uiCopy.student.chat.title} description={uiCopy.student.chat.subtitle} />
        <div className="student-chat-layout">
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
          />
          <ChatWorkspace
            activeSessionTitle={activeSessionTitle}
            courseId={courseId}
            setCourseId={setCourseId}
            classId={classId}
            setClassId={setClassId}
            messages={messages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            onSendQuery={onSendQuery}
            messagesEndRef={messagesEndRef}
          />
          <Card className="student-side-card" bodyStyle={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Tabs
              activeKey={activeSideTab}
              onChange={setActiveSideTab}
              centered
              items={[
                {
                  key: 'tab-code-review',
                  label: uiCopy.student.codeReview.title,
                  children: (
                    <CodeReviewPanel
                      codeLanguage={codeLanguage}
                      setCodeLanguage={setCodeLanguage}
                      codeSnippet={codeSnippet}
                      setCodeSnippet={setCodeSnippet}
                      onCodeReviewQuery={onCodeReviewQuery}
                      isCodeAnalyzing={isCodeAnalyzing}
                      codeMentorDiagnostics={codeMentorDiagnostics}
                    />
                  ),
                },
                {
                  key: 'tab-tutor-avatar',
                  label: uiCopy.student.avatar.title,
                  children: <TutorAvatarPanel avatarEmotion={avatarEmotion} setAvatarEmotion={setAvatarEmotion} />,
                },
              ]}
            />
          </Card>
        </div>
      </div>
    );
  }

  if (activeTab === 'student-memory') {
    return (
      <LearningProgress
        learnedTopics={learnedTopics}
        weakTopics={weakTopics}
        suggestions={suggestions}
        isSuggesting={isSuggesting}
        refreshSuggestions={refreshSuggestions}
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
          loadEscalations={loadEscalations}
          onSelectEscalation={handleSelectEscalation}
          onSendEscalationMsg={onSendEscalationMsg}
          onOpenMentorSelect={handleOpenMentorSelect}
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

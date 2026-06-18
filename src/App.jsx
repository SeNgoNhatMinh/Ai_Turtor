import React, { useState, useEffect } from 'react';
import { ConfigProvider } from 'antd';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import StudentPortal from './pages/StudentPortal';
import TeacherPortal from './pages/TeacherPortal';
import AdminPortal from './pages/AdminPortal';
import Login from './pages/Login';
import { apiService } from './services/api';
import { asArray, normalizeMessage, normalizeSession } from './services/normalizers';
import { getFptTheme } from './theme/fptTheme';

function App() {
  // State management
  const [currentUser, setCurrentUser] = useState(null);
  const [activeRole, setActiveRole] = useState('student');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('student-chat');
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeSessionTitle, setActiveSessionTitle] = useState('AI Tutor Chat');
  const [sessions, setSessions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [courseId, setCourseId] = useState('PRJ301');
  const [classId, setClassId] = useState('SE1840');

  // Code Review State
  const [codeMentorDiagnostics, setCodeMentorDiagnostics] = useState(null);
  const [isCodeAnalyzing, setIsCodeAnalyzing] = useState(false);

  // Materials & Submissions State
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  // Teacher State
  const [classesList] = useState([
    { semester: 'SEM5', course: 'PRJ301', classCode: 'SE1840', name: 'Class PRJ301_SE1840', details: 'Java Web Application | 30 students' },
    { semester: 'SEM5', course: 'PRO192', classCode: 'SE1841', name: 'Class PRO192_SE1841', details: 'Object-Oriented Programming | 28 students' }
  ]);
  const [teacherStudents] = useState([
    { id: 'student-a1', name: 'Student A', email: 'a@student.fpt.edu.vn', status: 'ACTIVE', weakTopics: ['JPA Relations', 'Spring Security'] },
    { id: 'student-a2', name: 'Student B', email: 'b@student.fpt.edu.vn', status: 'ACTIVE', weakTopics: ['None'] }
  ]);
  const [teacherSubmissions, setTeacherSubmissions] = useState([]);
  const [selectedTeacherSub, setSelectedTeacherSub] = useState(null);
  
  // Upload progress simulation state
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadProgressText, setUploadProgressText] = useState('');

  // Escalation & Candidate State
  const [escalations, setEscalations] = useState([
    { id: 'esc1', student: 'Student A1', title: 'JPA ManyToMany recursive mapping issue (StackOverflowError)', context: 'Course: PRJ301 | Class: SE1840', time: 'Waiting for 5 minutes', status: 'pending', question: 'JPA ManyToMany mapping causes StackOverflow.' }
  ]);
  const [selectedEscalation, setSelectedEscalation] = useState(null);
  const [candidates, setCandidates] = useState([]);

  // Admin State
  const [adminStats, setAdminStats] = useState({});
  const [diagnosticsOutput, setDiagnosticsOutput] = useState(null);
  const [isDiagnosticsRunning, setIsDiagnosticsRunning] = useState(false);
  const [adminPlans, setAdminPlans] = useState([]);

  // Suggestions state
  const [suggestions, setSuggestions] = useState([
    { priority: 'high', title: 'Review JPA Mapping: One-to-Many & Many-to-Many', content: 'The system detected repeated questions about JPA mapping and a 6.5/10 score in PRJ_Lab3. Review chapter 4 slides and retry lab 3.' },
    { priority: 'medium', title: 'Practice Spring Security authorization', content: 'A Code Review question reported a JWT filter chain 403 error. Review SecurityFilterChain concepts before fixing it.' }
  ]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  // UI state
  const [toastMessage, setToastMessage] = useState(null);
  const getStudentUserId = () => currentUser?.userId || currentUser?.id || 'student-a1';
  const getCurrentUserId = () => currentUser?.userId || currentUser?.id || 'teacher-a1';
  const getTeacherUserId = () => currentUser?.userId || currentUser?.id || 'mentor-1';

  // Initial loads
  useEffect(() => {
    loadChatSessions();
    loadAdminStats();
    loadSubscriptionPlans();
    setSelectedEscalation(escalations[0]);
  }, []);

  useEffect(() => {
    if (activeRole === 'student') {
      loadStudentAssignments();
    } else if (activeRole === 'teacher') {
      loadTeacherSubmissions();
      loadKnowledgeCandidates();
    }
  }, [activeRole, courseId, classId]);

  useEffect(() => {
    if (currentUser && activeRole === 'student') {
      loadChatSessions();
    }
  }, [currentUser, activeRole]);

  const loadStudentAssignments = async () => {
    try {
      const data = await apiService.getStudentAssignments(getStudentUserId());
      const assignList = asArray(data, 'content', 'assignments');
      setAssignments(assignList);
      if (assignList.length > 0 && !selectedAssignment) {
        setSelectedAssignment(assignList[0]);
      }
    } catch (e) {
      setAssignments([]);
    }
  };

  const loadTeacherSubmissions = async () => {
    try {
      const data = await apiService.getClassSubmissions(courseId, classId, getTeacherUserId());
      const subList = asArray(data, 'content', 'submissions');
      setTeacherSubmissions(subList);
      if (subList.length > 0 && !selectedTeacherSub) {
        setSelectedTeacherSub(subList[0]);
      }
    } catch (e) {
      setTeacherSubmissions([]);
    }
  };

  // Toast helper
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ==========================================
  // SIDEBAR NAVIGATION & PORTALS TAB SWITCHING
  // ==========================================
  const handleRoleChange = (role) => {
    setActiveRole(role);
    if (role === 'student') {
      setActiveTab('student-chat');
      loadChatSessions();
    } else if (role === 'teacher') {
      setActiveTab('teacher-classes');
    } else if (role === 'admin') {
      setActiveTab('admin-dashboard');
      loadAdminStats();
    }
  };

  const handleLoginSuccess = (user) => {
    let role = user.role;
    if (!role && user.email) {
      if (user.email.toLowerCase().includes('admin')) {
        role = 'admin';
      } else if (user.email.toLowerCase().includes('teacher') || user.email.toLowerCase().includes('mentor')) {
        role = 'teacher';
      } else {
        role = 'student';
      }
    }
    const updatedUser = { ...user, role: role || 'student' };
    setCurrentUser(updatedUser);
    handleRoleChange(role || 'student');
  };

  // ==========================================
  // CHAT SESSIONS LOADING & SWITCHING (STUDENT)
  // ==========================================
  const loadChatSessions = async () => {
    try {
      const data = await apiService.getConversations(getStudentUserId());
      setSessions(asArray(data, 'content', 'conversations').map(normalizeSession));
    } catch (e) {
      setSessions([]);
    }
  };

  const handleSelectSession = async (sessionId, title) => {
    setActiveSessionId(sessionId);
    setActiveSessionTitle(title);
    setMessages([]);
    const chatMsgs = await apiService.getMessages(sessionId, getStudentUserId());
    setMessages(asArray(chatMsgs, 'content', 'messages').map(normalizeMessage));
  };

  const handleCreateSession = async () => {
    const data = await apiService.createConversation(getStudentUserId());
    const session = normalizeSession(data);
    setActiveSessionId(session.id);
    setActiveSessionTitle(session.title);
    setMessages([]);
    triggerToast('New conversation created.');
    loadChatSessions();
  };

  const handleDeleteSession = async (sessionId) => {
    await apiService.deleteConversation(sessionId, getStudentUserId());
    triggerToast('Conversation deleted.');
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setActiveSessionTitle('AI Tutor Chat');
      setMessages([]);
    }
  };

  const handleRenameSession = async (sessionId, newTitle) => {
    await apiService.renameConversation(sessionId, newTitle, getStudentUserId());
    triggerToast('Conversation renamed.');
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s));
    if (activeSessionId === sessionId) {
      setActiveSessionTitle(newTitle);
    }
  };

  const handleSendQuery = async (chatInput, codeSnippet, setAvatarEmotion) => {
    // Add user message immediately
    const text = chatInput.trim();
    const userMsg = { question: text, answer: 'AI Tutor is thinking...' };
    setMessages(prev => [...prev, userMsg]);

    const payload = {
      question: text,
      message: text,
      codeSnippet: codeSnippet || null,
      courseId: courseId,
      classId: classId,
      conversationId: activeSessionId || null
    };

    try {
      const data = await apiService.sendAiQuery(payload, getStudentUserId());

      if (data.conversationId && !activeSessionId) {
        setActiveSessionId(data.conversationId);
        loadChatSessions();
      }

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          question: text,
          answer: data.answer,
          confidence: data.confidence,
          sources: data.sources || [],
          questionEscalationId: data.questionEscalationId || null
        };
        return updated;
      });

      if (data.mode === 'CODE_MENTOR') {
        setCodeMentorDiagnostics(data.answer);
        setAvatarEmotion('success');
      } else if (data.escalated) {
        setAvatarEmotion('idle');
      } else {
        setAvatarEmotion('success');
      }
    } catch (error) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          question: text,
          answer: `AI Tutor could not answer right now. ${error.message || 'Please check the backend AI service.'}`,
          confidence: 0,
          sources: []
        };
        return updated;
      });
      setAvatarEmotion('idle');
      triggerToast('AI Tutor request failed. Check backend AI services.');
    }
  };

  const handleCodeMentorQuery = async (codeSnippet, codeLanguage, isAssignmentRelated) => {
    setIsCodeAnalyzing(true);
    triggerToast('Analyzing source code...');

    const payload = {
      studentId: getStudentUserId(),
      courseId: courseId,
      classId: classId,
      question: 'Analyze this code issue',
      code: codeSnippet,
      language: codeLanguage,
      assignmentRelated: isAssignmentRelated,
      conversationId: activeSessionId || null
    };

    const data = await apiService.sendCodeMentorQuery(payload);
    setCodeMentorDiagnostics(data.answer);
    setIsCodeAnalyzing(false);
    triggerToast('Code analysis completed.');
  };

  // ==========================================
  // SUGGESTIONS ENGINE (STUDENT PORTAL)
  // ==========================================
  const refreshSuggestions = async () => {
    setIsSuggesting(true);
    triggerToast('AI is analyzing your learning memory...');

    const data = await apiService.getSuggestions(getStudentUserId(), courseId);
    setSuggestions(data.suggestions || []);
    setIsSuggesting(false);
    triggerToast('Study plan analysis completed.');
  };

  // ==========================================
  // STUDENT SUBMIT ASSIGNMENT
  // ==========================================
  const handleStudentSubmit = async (assignmentId, file, note) => {
    triggerToast('Submitting assignment...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('note', note);

    await apiService.submitAssignment(assignmentId, formData, getStudentUserId());
    triggerToast('Assignment submitted successfully.');
    // Reload assignments state to update status
    loadStudentAssignments();
  };

  // ==========================================
  // TEACHER ACTION HANDLERS
  // ==========================================
  const handleTeacherUploadMaterial = async (title, classIdVal, file) => {
    setUploadProgress(0);
    setUploadProgressText('Loading file...');

    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      if (progress > 90) {
        clearInterval(interval);
      } else {
        setUploadProgress(progress);
        setUploadProgressText(`Processing upload: ${progress}%`);
      }
    }, 200);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('teacherId', getTeacherUserId());
    if (classIdVal) formData.append('classId', classIdVal);

    // If title starts with 'Assignment', use assignment API, otherwise material API
    if (title.toLowerCase().includes('assignment')) {
      await apiService.uploadAssignment(courseId, classIdVal || classId, formData);
      triggerToast('New assignment published.');
    } else {
      await apiService.uploadMaterial(courseId, formData);
      triggerToast('Course material uploaded.');
    }

    clearInterval(interval);
    setUploadProgress(100);
    setUploadProgressText('Upload completed.');
    
    // Optionally reload teacher assignments here if there is UI for it
  };

  const handleTeacherGradeSubmit = async (submissionId, score, feedback, weakTopics) => {
    triggerToast('Saving grading results...');

    const payload = {
      teacherId: getTeacherUserId(),
      score: parseFloat(score),
      teacherFeedback: feedback,
      weakTopics: weakTopics
    };

    await apiService.gradeSubmission(submissionId, payload);
    triggerToast('Submission graded successfully.');

    // Reload submissions
    loadTeacherSubmissions();
  };

  const handleTeacherAnswerEsc = async (escalationId, reply) => {
    triggerToast('Sending answer and creating a knowledge candidate...');

    const payload = {
      teacherId: 'teacher-a-mentor-id',
      teacherName: 'Teacher B',
      answer: reply
    };

    await apiService.answerEscalation(escalationId, payload);
    triggerToast('Answer sent successfully.');

    // Update locally
    setEscalations(prev => prev.map(esc => {
      if (esc.id === escalationId) {
        return { ...esc, status: 'answered' };
      }
      return esc;
    }));
  };

  const loadKnowledgeCandidates = async () => {
    try {
      const data = await apiService.getKnowledgeCandidates('PENDING_REVIEW', courseId);
      setCandidates(asArray(data, 'candidates', 'content'));
    } catch (e) {
      setCandidates([]);
      triggerToast('Unable to load suggested AI answers.');
    }
  };

  const handleApproveCandidate = async (id) => {
    triggerToast('Approving suggested AI answer...');
    await apiService.approveCandidate(id, { reviewerId: getCurrentUserId() });
    triggerToast('Approved. The answer is ready for AI Tutor knowledge.');
    setCandidates(prev => prev.filter(c => c.id !== id));
  };

  const handleRejectCandidate = async (id, rejectionReason = 'Rejected by teacher') => {
    triggerToast('Rejecting suggested AI answer...');
    await apiService.rejectCandidate(id, {
      reviewerId: getCurrentUserId(),
      rejectionReason
    });
    triggerToast('Suggested AI answer rejected.');
    setCandidates(prev => prev.filter(c => c.id !== id));
  };

  // ==========================================
  // ADMIN PORTAL LOGIC
  // ==========================================
  const loadAdminStats = async () => {
    const stats = await apiService.getAdminStats();
    setAdminStats(stats);
  };

  const loadSubscriptionPlans = async () => {
    const plans = await apiService.getSubscriptionPlans();
    setAdminPlans(Array.isArray(plans) ? plans : []);
  };

  const runDiagnostics = async () => {
    setIsDiagnosticsRunning(true);
    triggerToast('Checking system connectivity...');

    const diag = await apiService.runDiagnostics();
    setDiagnosticsOutput(diag);
    setIsDiagnosticsRunning(false);
    triggerToast('System diagnostics completed.');
  };

  const handleAdminImport = async (file) => {
    triggerToast('Importing mentors from Excel...');

    const formData = new FormData();
    formData.append('file', file);

    const res = await apiService.importMentors(formData);
    triggerToast('Mentor import completed.');
    return res.log;
  };

  return (
    <ConfigProvider theme={getFptTheme(isDarkMode)}>
      {!currentUser ? (
        <>
          <Login onLoginSuccess={handleLoginSuccess} triggerToast={triggerToast} />
          {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
        </>
      ) : (
        <div className={`app-container ${isDarkMode ? 'dark' : 'light'}`}>
          {/* HEADER */}
          <Header 
            activeRole={activeRole} 
            handleRoleChange={handleRoleChange} 
            isDarkMode={isDarkMode} 
            setIsDarkMode={setIsDarkMode} 
            currentUser={currentUser}
            onLogout={() => setCurrentUser(null)}
          />

          {/* MAIN CONTAINER */}
          <div className="main-layout">
        
            {/* SIDEBAR */}
            <Sidebar activeRole={activeRole} activeTab={activeTab} switchTab={setActiveTab} />

            {/* VIEW AREA */}
            <main className="content-wrapper">
              {activeRole === 'student' && (
                <StudentPortal
                  activeTab={activeTab}
                  courseId={courseId}
                  setCourseId={setCourseId}
                  classId={classId}
                  setClassId={setClassId}
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  activeSessionTitle={activeSessionTitle}
                  messages={messages}
                  handleCreateSession={handleCreateSession}
                  handleSelectSession={handleSelectSession}
                  handleDeleteSession={handleDeleteSession}
                  handleRenameSession={handleRenameSession}
                  handleSendQuery={handleSendQuery}
                  codeMentorDiagnostics={codeMentorDiagnostics}
                  isCodeAnalyzing={isCodeAnalyzing}
                  handleCodeMentorQuery={handleCodeMentorQuery}
                  assignments={assignments}
                  selectedAssignment={selectedAssignment}
                  setSelectedAssignment={setSelectedAssignment}
                  handleStudentSubmit={handleStudentSubmit}
                  suggestions={suggestions}
                  isSuggesting={isSuggesting}
                  refreshSuggestions={refreshSuggestions}
                  triggerToast={triggerToast}
                  userId={getStudentUserId()}
                />
              )}

              {activeRole === 'teacher' && (
                <TeacherPortal
                  activeTab={activeTab}
                  courseId={courseId}
                  classId={classId}
                  setClassId={setClassId}
                  classesList={classesList}
                  teacherStudents={teacherStudents}
                  teacherSubmissions={teacherSubmissions}
                  selectedTeacherSub={selectedTeacherSub}
                  setSelectedTeacherSub={setSelectedTeacherSub}
                  uploadProgress={uploadProgress}
                  uploadProgressText={uploadProgressText}
                  escalations={escalations}
                  selectedEscalation={selectedEscalation}
                  setSelectedEscalation={setSelectedEscalation}
                  candidates={candidates}
                  setCandidates={setCandidates}
                  handleTeacherUploadMaterial={handleTeacherUploadMaterial}
                  handleTeacherGradeSubmit={handleTeacherGradeSubmit}
                  handleTeacherAnswerEsc={handleTeacherAnswerEsc}
                  handleApproveCandidate={handleApproveCandidate}
                  handleRejectCandidate={handleRejectCandidate}
                  triggerToast={triggerToast}
                />
              )}

              {activeRole === 'admin' && (
                <AdminPortal
                  activeTab={activeTab}
                  adminStats={adminStats}
                  diagnosticsOutput={diagnosticsOutput}
                  isDiagnosticsRunning={isDiagnosticsRunning}
                  runDiagnostics={runDiagnostics}
                  adminPlans={adminPlans}
                  handleAdminImport={handleAdminImport}
                  triggerToast={triggerToast}
                />
              )}
            </main>
          </div>
          {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
        </div>
      )}
    </ConfigProvider>
  );
}

export default App;

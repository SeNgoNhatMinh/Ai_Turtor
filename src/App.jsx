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
import { asArray, normalizeMessage, normalizeSession, normalizeTeacherInboxItem, normalizeAnswerReview, normalizeStudentDashboard, normalizeTeacherDashboard } from './services/normalizers';
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
  const [classesList, setClassesList] = useState([]);
  const [teacherStudents, setTeacherStudents] = useState([]);
  const [teacherTopicHeatmap, setTeacherTopicHeatmap] = useState([]);
  const [teacherDashboardLoading, setTeacherDashboardLoading] = useState(false);
  const [teacherSubmissions, setTeacherSubmissions] = useState([]);
  const [selectedTeacherSub, setSelectedTeacherSub] = useState(null);
  
  // Upload progress simulation state
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadProgressText, setUploadProgressText] = useState('');

  // Escalation & Candidate State
  const [escalations, setEscalations] = useState([]);
  const [teacherChatInbox, setTeacherChatInbox] = useState([]);
  const [isTeacherInboxLoading, setIsTeacherInboxLoading] = useState(false);
  const [selectedEscalation, setSelectedEscalation] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [answerReviews, setAnswerReviews] = useState([]);
  const [seniorAnswerReviews, setSeniorAnswerReviews] = useState([]);

  // Student dashboard
  const [studentDashboard, setStudentDashboard] = useState({ learnedTopics: [], weakTopics: [], stats: {} });
  const [isStudentDashboardLoading, setIsStudentDashboardLoading] = useState(false);

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
  }, []);

  useEffect(() => {
    if (activeRole === 'student') {
      loadStudentAssignments();
    } else if (activeRole === 'teacher') {
      loadTeacherSubmissions();
      loadKnowledgeCandidates();
      loadTeacherDashboard();
      loadTeacherInbox();
      loadAnswerReviews();
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

  const loadStudentDashboard = async () => {
    setIsStudentDashboardLoading(true);
    try {
      const data = await apiService.getStudentDashboard(getStudentUserId(), courseId);
      const normalized = normalizeStudentDashboard(data);
      setStudentDashboard(normalized);
      if (normalized.suggestions?.length) {
        setSuggestions(normalized.suggestions);
      }
    } catch (e) {
      try {
        const memory = await apiService.getStudentMemory(getStudentUserId(), courseId);
        setStudentDashboard({
          learnedTopics: memory.learnedTopics || [],
          weakTopics: memory.weakTopics || [],
          stats: {},
        });
      } catch {
        setStudentDashboard({ learnedTopics: [], weakTopics: [], stats: {} });
      }
    } finally {
      setIsStudentDashboardLoading(false);
    }
  };

  const loadTeacherDashboard = async () => {
    setTeacherDashboardLoading(true);
    try {
      const data = await apiService.getTeacherDashboard(getTeacherUserId(), courseId, classId);
      const normalized = normalizeTeacherDashboard(data);
      setTeacherTopicHeatmap(normalized.topicHeatmap);

      const sections = normalized.classSections;
      if (sections.length) {
        setClassesList(sections.map((s) => ({
          semester: s.semesterId || s.semesterCode || '—',
          course: s.courseId || courseId,
          classCode: s.classId || s.id,
          name: s.name || `Class ${s.courseId}_${s.classId}`,
          details: s.description || `${s.studentCount ?? '—'} students`,
        })));
      } else {
        const fallback = await apiService.getTeacherClassSections(getTeacherUserId());
        const list = asArray(fallback, 'content', 'classSections');
        setClassesList(list.map((s) => ({
          semester: s.semesterId || '—',
          course: s.courseId || courseId,
          classCode: s.classId || s.id,
          name: s.name || `Class ${s.courseId}_${s.classId}`,
          details: `${s.studentCount ?? '—'} students`,
        })));
      }

      if (normalized.students.length) {
        setTeacherStudents(normalized.students.map((s) => ({
          id: s.studentId || s.id || s.userId,
          name: s.fullName || s.name || s.studentId,
          email: s.email || '—',
          status: s.status || 'ACTIVE',
          weakTopics: s.weakTopics?.length ? s.weakTopics : ['None'],
        })));
      } else {
        try {
          const studentsData = await apiService.getClassStudents(courseId, classId);
          const students = asArray(studentsData, 'students', 'content');
          setTeacherStudents(students.map((s) => ({
            id: s.studentId || s.id,
            name: s.fullName || s.name || s.studentId,
            email: s.email || '—',
            status: s.status || 'ACTIVE',
            weakTopics: s.weakTopics?.length ? s.weakTopics : ['None'],
          })));
        } catch {
          setTeacherStudents([]);
        }
      }
    } catch (e) {
      setTeacherStudents([]);
      setTeacherTopicHeatmap([]);
    } finally {
      setTeacherDashboardLoading(false);
    }
  };

  const loadTeacherInbox = async () => {
    setIsTeacherInboxLoading(true);
    try {
      const data = await apiService.getTeacherEscalationInbox(getTeacherUserId(), { courseId });
      const items = asArray(data, 'escalations', 'inbox', 'content').map(normalizeTeacherInboxItem);
      setEscalations(items);
      setTeacherChatInbox(items.filter((e) => e.chatRoomId && ['assigned', 'active'].includes(e.status)));
      if (items.length && !selectedEscalation) {
        setSelectedEscalation(items[0]);
      }
    } catch (e) {
      setEscalations([]);
      setTeacherChatInbox([]);
    } finally {
      setIsTeacherInboxLoading(false);
    }
  };

  const loadAnswerReviews = async () => {
    try {
      const [mentorPending, seniorPending] = await Promise.all([
        apiService.getMentorPendingAnswerReviews(courseId),
        apiService.getSeniorPendingAnswerReviews(courseId),
      ]);
      setAnswerReviews((Array.isArray(mentorPending) ? mentorPending : []).map(normalizeAnswerReview));
      setSeniorAnswerReviews((Array.isArray(seniorPending) ? seniorPending : []).map(normalizeAnswerReview));
    } catch (e) {
      setAnswerReviews([]);
      setSeniorAnswerReviews([]);
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
      teacherId: getTeacherUserId(),
      teacherName: currentUser?.fullName || currentUser?.name || 'Teacher',
      answer: reply
    };

    await apiService.answerEscalation(escalationId, payload);
    triggerToast('Answer sent successfully.');

    setEscalations(prev => prev.map(esc => {
      if (esc.id === escalationId) {
        return { ...esc, status: 'answered' };
      }
      return esc;
    }));
    loadTeacherInbox();
  };

  const handleMentorReviewAnswer = async (review, accurate, feedback) => {
    triggerToast('Submitting AI answer review...');
    await apiService.submitAnswerReview({
      studentId: review.studentId,
      courseId: review.courseId || courseId,
      classId: review.classId || classId,
      conversationId: review.conversationId,
      questionEscalationId: review.questionEscalationId,
      mode: review.mode || 'RAG',
      reviewType: review.reviewType || 'ANSWER_DISPUTE',
      question: review.question,
      answer: review.answer,
      accurate,
      helpful: accurate,
      correctnessLevel: accurate ? 'HIGH' : 'INCORRECT',
      feedback,
      reviewedBy: getTeacherUserId(),
      reviewerRole: 'MENTOR',
    });
    triggerToast(accurate ? 'Review submitted — AI answer confirmed.' : 'Review submitted — correction noted.');
    loadAnswerReviews();
  };

  const handleSeniorResolveReview = async (reviewId, decision, notes) => {
    triggerToast('Resolving senior review...');
    await apiService.seniorResolveAnswerReview(reviewId, {
      seniorReviewerId: getTeacherUserId(),
      seniorReviewerName: currentUser?.fullName || currentUser?.name || 'Senior Mentor',
      reviewerRole: 'SENIOR_MENTOR',
      decision,
      notes,
    });
    triggerToast('Senior review resolved.');
    loadAnswerReviews();
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
                  studentDashboard={studentDashboard}
                  isStudentDashboardLoading={isStudentDashboardLoading}
                  loadStudentDashboard={loadStudentDashboard}
                  onMarkChatRead={(chatRoomId) => apiService.markChatRead(chatRoomId, getStudentUserId())}
                  onCloseChat={(payload) => apiService.closeChat({ ...payload, userId: getStudentUserId() })}
                  onGetChatDetail={(chatRoomId) => apiService.getChatDetail(chatRoomId)}
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
                  answerReviews={answerReviews}
                  seniorAnswerReviews={seniorAnswerReviews}
                  teacherChatInbox={teacherChatInbox}
                  isTeacherInboxLoading={isTeacherInboxLoading}
                  teacherTopicHeatmap={teacherTopicHeatmap}
                  teacherDashboardLoading={teacherDashboardLoading}
                  teacherUserId={getTeacherUserId()}
                  loadTeacherInbox={loadTeacherInbox}
                  loadTeacherDashboard={loadTeacherDashboard}
                  loadAnswerReviews={loadAnswerReviews}
                  handleTeacherUploadMaterial={handleTeacherUploadMaterial}
                  handleTeacherGradeSubmit={handleTeacherGradeSubmit}
                  handleTeacherAnswerEsc={handleTeacherAnswerEsc}
                  handleApproveCandidate={handleApproveCandidate}
                  handleRejectCandidate={handleRejectCandidate}
                  handleMentorReviewAnswer={handleMentorReviewAnswer}
                  handleSeniorResolveReview={handleSeniorResolveReview}
                  onMarkChatRead={(chatRoomId) => apiService.markChatRead(chatRoomId, getTeacherUserId())}
                  onCloseChat={(payload) => apiService.closeChat({ ...payload, closedBy: getTeacherUserId() })}
                  onGetChatDetail={(chatRoomId) => apiService.getChatDetail(chatRoomId)}
                  onSendChatMessage={(payload) => apiService.sendChatMessage(payload)}
                  onGetChatHistory={(chatRoomId) => apiService.getChatHistory(chatRoomId)}
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

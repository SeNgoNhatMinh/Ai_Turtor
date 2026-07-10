import { Suspense, lazy, useState, useEffect } from 'react';
import { ConfigProvider, Spin } from 'antd';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import Login from './pages/Login';
import { apiService } from './services/api';
import { getUserFacingError } from './services/apiClient';
import { normalizeStudentDashboard, normalizeSuggestions } from './services/normalizers';
import { getFptTheme } from './theme/fptTheme';
import { n8nService } from './services/n8nService';
import { N8N_ENABLED } from './services/n8nClient';
import { useStudentEnrollmentOptions } from './hooks/useStudentEnrollmentOptions';
import { useStudentChatController } from './hooks/useStudentChatController';
import { useToastMessage } from './hooks/useToastMessage';
import { useCodeMentorController } from './hooks/useCodeMentorController';
import { useStudentAssignmentsController } from './hooks/useStudentAssignmentsController';
import { useCourseMaterialsController } from './hooks/useCourseMaterialsController';
import { useAdminRuntimeController } from './hooks/useAdminRuntimeController';
import { useTeacherRuntimeController } from './hooks/useTeacherRuntimeController';
import { FEEDBACK_RECORDED_MESSAGE } from './constants/answerReview';
import {
  createRecoveredSuggestion,
  readJsonStorage,
  readPinnedSuggestions,
  sanitizePersistedUser,
  suggestionMatchesText,
  writePinnedSuggestions,
  readAnalyzedSuggestions,
  writeAnalyzedSuggestions,
  mergeSuggestionLists,
} from './utils/storage';
import { normalizeAppRole } from './utils/formatters';

const StudentPortal = lazy(() => import('./pages/StudentPortal'));
const TeacherPortal = lazy(() => import('./pages/TeacherPortal'));
const AdminPortal = lazy(() => import('./pages/AdminPortal'));

const APP_SESSION_USER_KEY = 'ai-tutor:current-user';
const APP_UI_STATE_KEY = 'ai-tutor:ui-state';

const createStudyTipSuggestion = (text) => ({
  priority: 'high',
  title: String(text || '').trim(),
  content: 'Created from the study note you selected in AI Tutor Chat. Review it first, then use Study now or Create quiz when you are ready.',
  source: 'CHAT_STUDY_TIP',
});

const isSuggestionServiceFailure = (suggestion) => {
  const value = `${suggestion?.title || ''} ${suggestion?.content || ''}`.toLowerCase();
  return value.includes('ai suggestion failed') || value.includes('llm') || value.includes('dịch vụ llm');
};

function App() {
  // State management
  const initialUiState = readJsonStorage(APP_UI_STATE_KEY, {});
  const [currentUser, setCurrentUser] = useState(() => sanitizePersistedUser(readJsonStorage(APP_SESSION_USER_KEY, null)));
  const [activeRole, setActiveRole] = useState(() => initialUiState.activeRole || 'student');
  const [isDarkMode, setIsDarkMode] = useState(() => Boolean(initialUiState.isDarkMode));
  const [activeTab, setActiveTab] = useState(() => initialUiState.activeTab || 'student-chat');
  const [courseId, setCourseId] = useState(() => initialUiState.courseId || 'PRJ301');
  const [classId, setClassId] = useState(() => initialUiState.classId || 'SE1840');
  const currentUserId = currentUser?.userId || currentUser?.id || '';
  const { courseOptions, classOptions, loadStudentEnrollments } = useStudentEnrollmentOptions({
    studentId: currentUserId,
    courseId,
    classId,
    setCourseId,
    setClassId,
  });

  useEffect(() => {
    document.body.classList.toggle('theme-dark', isDarkMode);
    document.body.classList.toggle('theme-light', !isDarkMode);

    return () => {
      document.body.classList.remove('theme-dark', 'theme-light');
    };
  }, [isDarkMode]);

  useEffect(() => {
    if (!currentUser) {
      window.sessionStorage.removeItem(APP_SESSION_USER_KEY);
      return;
    }
    window.sessionStorage.setItem(APP_SESSION_USER_KEY, JSON.stringify(sanitizePersistedUser(currentUser)));
  }, [currentUser]);

  useEffect(() => {
    window.sessionStorage.setItem(APP_UI_STATE_KEY, JSON.stringify({
      activeRole,
      activeTab,
      courseId,
      classId,
      isDarkMode,
    }));
  }, [activeRole, activeTab, courseId, classId, isDarkMode]);

  // Code Review State
  const { toastMessage, setToastMessage, triggerToast } = useToastMessage();

  // Student dashboard
  const [studentDashboard, setStudentDashboard] = useState({ learnedTopics: [], weakTopics: [], stats: {} });
  const [isStudentDashboardLoading, setIsStudentDashboardLoading] = useState(false);

  // Suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  // UI state
  const getStudentUserId = () => currentUserId;
  const getTeacherUserId = () => currentUserId;
  const {
    classesList,
    teacherStudents,
    teacherTopicHeatmap,
    teacherDashboardLoading,
    teacherSubmissions,
    quizSubmissions,
    setQuizSubmissions,
    selectedTeacherSub,
    setSelectedTeacherSub,
    escalations,
    teacherChatInbox,
    isTeacherInboxLoading,
    selectedEscalation,
    setSelectedEscalation,
    candidates,
    setCandidates,
    answerReviews,
    seniorAnswerReviews,
    loadTeacherSubmissions,
    loadKnowledgeCandidates,
    loadTeacherDashboard,
    loadTeacherInbox,
    loadAnswerReviews,
    handleTeacherQuizReview,
    handleTeacherGradeSubmit,
    handleTeacherAnswerEsc,
    handleMentorReviewAnswer,
    handleSeniorResolveReview,
    handleApproveCandidate,
    handleRejectCandidate,
  } = useTeacherRuntimeController({
    currentUser,
    activeRole,
    courseId,
    classId,
    triggerToast,
  });
  const {
    setCodeMentorDiagnostics,
  } = useCodeMentorController({
    studentId: currentUserId,
    courseId,
    classId,
    triggerToast,
  });
  const {
    activeSessionId,
    activeSessionTitle,
    sessions,
    isSessionsLoading,
    messages,
    activeSessionQuestionCount,
    activeSessionMaxTurnsReached,
    turnLimitNotice,
    dismissTurnLimitNotice,
    resetChat,
    loadChatSessions,
    handleSelectSession,
    handleCreateSession,
    handleDeleteSession,
    handleRenameSession,
    handleSendQuery,
    handleStopAiGeneration,
    openLearnedSuggestionResponse,
  } = useStudentChatController({
    currentUser,
    courseId,
    classId,
    triggerToast,
    setCodeMentorDiagnostics,
  });
  const {
    assignments,
    selectedAssignment,
    setSelectedAssignment,
    loadStudentAssignments,
    handleStudentSubmit,
    handleDownloadAssignment,
  } = useStudentAssignmentsController({
    studentId: currentUserId,
    triggerToast,
  });
  const {
    courseMaterials,
    uploadProgress,
    uploadProgressText,
    loadCourseMaterials,
    handleTeacherUploadMaterial,
    handleDownloadMaterial,
  } = useCourseMaterialsController({
    courseId,
    classId,
    teacherId: currentUserId,
    triggerToast,
  });
  const {
    adminStats,
    diagnosticsOutput,
    isDiagnosticsRunning,
    adminPlans,
    loadAdminStats,
    loadSubscriptionPlans,
    runDiagnostics,
    handleAdminImport,
  } = useAdminRuntimeController({ triggerToast });

  useEffect(() => {
    if (!currentUser) return;
    if (activeRole === 'student') {
      loadStudentEnrollments();
      loadChatSessions();
      loadStudentAssignments();
      loadCourseMaterials();
    } else if (activeRole === 'teacher') {
      loadTeacherSubmissions();
      loadKnowledgeCandidates();
      loadTeacherDashboard();
      loadTeacherInbox();
      loadAnswerReviews();
      loadCourseMaterials();
    } else if (activeRole === 'admin') {
      loadAdminStats();
      loadSubscriptionPlans();
    }
  }, [currentUser, activeRole, courseId, classId]);

  useEffect(() => {
    if (currentUser && activeRole === 'student') {
      loadStudentEnrollments();
      loadChatSessions();
    }
  }, [currentUser, activeRole]);

  const loadStudentDashboard = async () => {
    setIsStudentDashboardLoading(true);
    const studentId = getStudentUserId();
    const localPinnedSuggestions = readPinnedSuggestions(studentId, courseId);
    try {
      const data = await apiService.getStudentDashboard(studentId, courseId);
      const normalized = normalizeStudentDashboard(data);
      let memorySnapshot = null;
      try {
        memorySnapshot = await apiService.getStudentMemory(studentId, courseId);
      } catch (memoryError) {
        console.warn('Student memory lookup failed while loading dashboard:', memoryError);
      }
      const mergedPinnedSuggestions = [
        ...(normalized.pinnedImproveSuggestions || []),
        ...(memorySnapshot?.pinnedImproveSuggestions || []),
        ...localPinnedSuggestions,
      ];
      setStudentDashboard({
        ...normalized,
        learnedTopics: memorySnapshot?.learnedTopics?.length ? memorySnapshot.learnedTopics : normalized.learnedTopics,
        weakTopics: memorySnapshot?.weakTopics?.length ? memorySnapshot.weakTopics : normalized.weakTopics,
        pinnedImproveSuggestions: [...new Set(mergedPinnedSuggestions)],
        summary: memorySnapshot?.summary || normalized.summary || '',
        classId: memorySnapshot?.classId || normalized.classId || classId,
        recentQuestions: memorySnapshot?.recentQuestions || normalized.recentQuestions || [],
        recentAnswers: memorySnapshot?.recentAnswers || normalized.recentAnswers || [],
        updatedAt: memorySnapshot?.updatedAt || normalized.updatedAt || '',
      });
      const localSuggestions = readAnalyzedSuggestions(studentId, courseId);
      const mergedSuggestions = mergeSuggestionLists(localSuggestions, normalized.suggestions || []);
      
      if (mergedSuggestions.length) {
        setSuggestions(mergedSuggestions);
        writeAnalyzedSuggestions(studentId, courseId, mergedSuggestions);
      }
    } catch {
      try {
        const memory = await apiService.getStudentMemory(studentId, courseId);
        const mergedPinnedSuggestions = [
          ...(memory.pinnedImproveSuggestions || []),
          ...localPinnedSuggestions,
        ];
        setStudentDashboard({
          learnedTopics: memory.learnedTopics || [],
          weakTopics: memory.weakTopics || [],
          pinnedImproveSuggestions: [...new Set(mergedPinnedSuggestions)],
          summary: memory.summary || '',
          classId: memory.classId || classId,
          recentQuestions: memory.recentQuestions || [],
          recentAnswers: memory.recentAnswers || [],
          updatedAt: memory.updatedAt || '',
          stats: {},
        });
      } catch {
        setStudentDashboard({ learnedTopics: [], weakTopics: [], pinnedImproveSuggestions: localPinnedSuggestions, stats: {} });
      }
    } finally {
      setIsStudentDashboardLoading(false);
    }
  };

  // ==========================================
  // SIDEBAR NAVIGATION & PORTALS TAB SWITCHING
  // ==========================================
  const handleRoleChange = (role) => {
    const normalizedRole = normalizeAppRole(role, currentUser?.email);
    setActiveRole(normalizedRole);
    if (normalizedRole === 'student') {
      setActiveTab('student-chat');
    } else if (normalizedRole === 'teacher') {
      setActiveTab('teacher-classes');
    } else if (normalizedRole === 'admin') {
      setActiveTab('admin-dashboard');
    }
  };

  const handleLoginSuccess = (user) => {
    const originalRole = user?.originalRole || user?.role || user?.roleKey || user?.authority || user?.userRole || '';
    const role = normalizeAppRole(originalRole, user?.email);
    const updatedUser = { ...user, originalRole, role };
    setCurrentUser(updatedUser);
    handleRoleChange(role);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    resetChat();
    window.sessionStorage.removeItem(APP_SESSION_USER_KEY);
    window.localStorage.removeItem('ai_tutor_jwt');
  };

  // ==========================================
  // SUGGESTIONS ENGINE (STUDENT PORTAL)
  // ==========================================
  const refreshSuggestions = async (question = '') => {
    const questionText = String(question || '').trim();
    const studentId = getStudentUserId();
    setIsSuggesting(true);
    triggerToast(questionText ? 'AI is analyzing this study tip...' : 'AI is analyzing your learning memory...');

    try {
      const data = await apiService.getSuggestions(studentId, courseId, {
        classId,
        question: questionText || undefined,
        includeAiSuggestion: Boolean(questionText),
      });
      const normalized = normalizeSuggestions(data).filter((item) => !isSuggestionServiceFailure(item));
      const focusedSuggestion = questionText ? createStudyTipSuggestion(questionText) : null;
      const finalSuggestions = mergeSuggestionLists(
        focusedSuggestion ? [focusedSuggestion] : [],
        normalized,
        suggestions,
      );
      setSuggestions(finalSuggestions);
      writeAnalyzedSuggestions(studentId, courseId, finalSuggestions);
      if (questionText) {
        setActiveTab('student-memory');
        loadStudentDashboard();
      }
      triggerToast(questionText ? 'Study tip added to Learning Progress.' : 'Study plan analysis completed.');
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      triggerToast(getUserFacingError(error, 'Unable to analyze learning suggestions.'));
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleStudentUpdateMemory = async (learnedList, weakList) => {
    triggerToast('Updating learning profiler...');
    try {
      const payload = {
        classId,
        learnedTopics: learnedList,
        weakTopics: weakList,
        summary: `Manually updated concepts: ${learnedList.join(', ')}. Focus areas: ${weakList.join(', ')}.`
      };
      await apiService.updateStudentMemory(getStudentUserId(), courseId, payload);
      triggerToast('Profiler updated successfully.');
      loadStudentDashboard();
    } catch (e) {
      console.error('Error updating memory:', e);
      triggerToast(getUserFacingError(e, 'Unable to update learning profiler.'));
    }
  };

  const handlePinImproveSuggestion = async (suggestion) => {
    const studentId = getStudentUserId();
    try {
      const memory = await apiService.pinImproveSuggestion(studentId, courseId, suggestion);
      const fallbackPinnedSuggestions = [
        ...new Set([...(studentDashboard?.pinnedImproveSuggestions || []), suggestion]),
      ];
      const nextPinnedSuggestions = memory?.pinnedImproveSuggestions?.length
        ? memory.pinnedImproveSuggestions
        : fallbackPinnedSuggestions;
      setStudentDashboard((prev) => ({
        ...prev,
        learnedTopics: memory?.learnedTopics || prev?.learnedTopics || [],
        weakTopics: memory?.weakTopics || prev?.weakTopics || [],
        pinnedImproveSuggestions: nextPinnedSuggestions,
      }));
      writePinnedSuggestions(studentId, courseId, nextPinnedSuggestions);
      triggerToast('Suggestion pinned.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to pin suggestion.'));
    }
  };

  const handleUnpinImproveSuggestion = async (suggestion) => {
    const studentId = getStudentUserId();
    try {
      const memory = await apiService.unpinImproveSuggestion(studentId, courseId, suggestion);
      const fallbackPinnedSuggestions = (studentDashboard?.pinnedImproveSuggestions || []).filter(
        (item) => String(item).toLowerCase() !== String(suggestion).toLowerCase(),
      );
      const nextPinnedSuggestions = Array.isArray(memory?.pinnedImproveSuggestions)
        ? memory.pinnedImproveSuggestions
        : fallbackPinnedSuggestions;
      setStudentDashboard((prev) => ({
        ...prev,
        learnedTopics: memory?.learnedTopics || prev?.learnedTopics || [],
        weakTopics: memory?.weakTopics || prev?.weakTopics || [],
        pinnedImproveSuggestions: nextPinnedSuggestions,
      }));
      setSuggestions((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        if (list.some((item) => suggestionMatchesText(item, suggestion))) {
          return list;
        }
        return [createRecoveredSuggestion(suggestion), ...list];
      });
      writePinnedSuggestions(studentId, courseId, nextPinnedSuggestions);
      triggerToast('Suggestion unpinned.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to unpin suggestion.'));
    }
  };

  const handleStudentReviewAnswer = async (reviewPayload) => {
    triggerToast('Submitting your feedback...');
    try {
      if (N8N_ENABLED) {
        try {
          await n8nService.submitAnswerReview(reviewPayload);
          triggerToast(FEEDBACK_RECORDED_MESSAGE);
        } catch (n8nErr) {
          console.warn('n8n feedback failed, falling back to backend API:', n8nErr);
          await apiService.submitAnswerReview(reviewPayload);
          triggerToast(FEEDBACK_RECORDED_MESSAGE);
        }
      } else {
        await apiService.submitAnswerReview(reviewPayload);
        triggerToast(FEEDBACK_RECORDED_MESSAGE);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      triggerToast(getUserFacingError(error, 'Unable to submit feedback. Please try again.'));
    }
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
            onLogout={handleLogout}
          />

          {/* MAIN CONTAINER */}
          <div className="main-layout">
        
            {/* SIDEBAR */}
            <Sidebar activeRole={activeRole} activeTab={activeTab} switchTab={setActiveTab} />

            {/* VIEW AREA */}
            <main className="content-wrapper">
              <Suspense fallback={<div className="portal-loading"><Spin description="Loading workspace..." /></div>}>
              {activeRole === 'student' && (
                <StudentPortal
                  activeTab={activeTab}
                  switchTab={setActiveTab}
                  courseId={courseId}
                  setCourseId={setCourseId}
                  classId={classId}
                  setClassId={setClassId}
                  courseOptions={courseOptions}
                  classOptions={classOptions}
                  isDarkMode={isDarkMode}
                  sessions={sessions}
                  isSessionsLoading={isSessionsLoading}
                  activeSessionId={activeSessionId}
                  activeSessionTitle={activeSessionTitle}
                  messages={messages}
                  activeSessionQuestionCount={activeSessionQuestionCount}
                  activeSessionMaxTurnsReached={activeSessionMaxTurnsReached}
                  turnLimitNotice={turnLimitNotice}
                  dismissTurnLimitNotice={dismissTurnLimitNotice}
                  resetChat={resetChat}
                  handleCreateSession={handleCreateSession}
                  handleSelectSession={handleSelectSession}
                  handleDeleteSession={handleDeleteSession}
                  handleRenameSession={handleRenameSession}
                  handleSendQuery={handleSendQuery}
                  handleStopAiGeneration={handleStopAiGeneration}
                  openLearnedSuggestionResponse={openLearnedSuggestionResponse}
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
                  onPinSuggestion={handlePinImproveSuggestion}
                  onUnpinSuggestion={handleUnpinImproveSuggestion}
                  onMarkChatRead={(chatRoomId) => apiService.markChatRead(chatRoomId, getStudentUserId())}
                  onCloseChat={(payload) => apiService.closeChat({ ...payload, userId: getStudentUserId() })}
                  onGetChatDetail={(chatRoomId) => apiService.getChatDetail(chatRoomId)}
                  handleStudentReviewAnswer={handleStudentReviewAnswer}
                  onDownloadAssignment={handleDownloadAssignment}
                  onUpdateMemory={handleStudentUpdateMemory}
                  courseMaterials={courseMaterials}
                  onDownloadMaterial={handleDownloadMaterial}
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
                  quizSubmissions={quizSubmissions}
                  setQuizSubmissions={setQuizSubmissions}
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
                  handleTeacherQuizReview={handleTeacherQuizReview}
                  handleMentorReviewAnswer={handleMentorReviewAnswer}
                  handleSeniorResolveReview={handleSeniorResolveReview}
                  onMarkChatRead={(chatRoomId) => apiService.markChatRead(chatRoomId, getTeacherUserId())}
                  onCloseChat={(payload) => apiService.closeChat({ ...payload, closedBy: getTeacherUserId() })}
                  onGetChatDetail={(chatRoomId) => apiService.getChatDetail(chatRoomId)}
                  onSendChatMessage={(payload) => apiService.sendChatMessage(payload)}
                  onGetChatHistory={(chatRoomId) => apiService.getChatHistory(chatRoomId)}
                  triggerToast={triggerToast}
                  courseMaterials={courseMaterials}
                  onDownloadMaterial={handleDownloadMaterial}
                  currentUserRole={currentUser?.originalRole || currentUser?.role || activeRole}
                  currentUser={currentUser}
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
                  currentUser={currentUser}
                />
              )}
              </Suspense>
            </main>
          </div>
          {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
        </div>
      )}
    </ConfigProvider>
  );
}

export default App;

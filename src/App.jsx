import { Suspense, lazy, useState, useEffect } from 'react';
import { ConfigProvider, Spin } from 'antd';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import Login from './pages/Login';
import { apiService } from './services/api';
import { getUserFacingError } from './services/apiClient';
import { asArray, normalizeTeacherInboxItem, normalizeAnswerReview, normalizeStudentDashboard, normalizeTeacherDashboard, normalizeSuggestions } from './services/normalizers';
import { getFptTheme } from './theme/fptTheme';
import { n8nService } from './services/n8nService';
import { N8N_ENABLED } from './services/n8nClient';
import { useStudentEnrollmentOptions } from './hooks/useStudentEnrollmentOptions';
import { useStudentChatController } from './hooks/useStudentChatController';
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
  const [codeMentorDiagnostics, setCodeMentorDiagnostics] = useState(null);
  const [isCodeAnalyzing, setIsCodeAnalyzing] = useState(false);

  // Materials & Submissions State
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [courseMaterials, setCourseMaterials] = useState([]);


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
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  // UI state
  const [toastMessage, setToastMessage] = useState(null);
  const getStudentUserId = () => currentUserId;
  const getCurrentUserId = () => currentUserId;
  const getTeacherUserId = () => currentUserId;
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };
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

  const loadCourseMaterials = async () => {
    try {
      const data = await apiService.getCourseMaterials(courseId, classId);
      setCourseMaterials(asArray(data, 'materials', 'content'));
    } catch (e) {
      setCourseMaterials([]);
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
    } catch (e) {
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
      setTeacherChatInbox(items.filter((e) => e.chatRoomId && ['assigned', 'active', 'in_chat'].includes(e.status)));
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
    const role = normalizeAppRole(user?.role, user?.email);
    const updatedUser = { ...user, role };
    setCurrentUser(updatedUser);
    handleRoleChange(role);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    resetChat();
    window.sessionStorage.removeItem(APP_SESSION_USER_KEY);
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
      triggerToast('Failed to analyze learning suggestions.');
    } finally {
      setIsSuggesting(false);
    }
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
      triggerToast('Failed to update profiler.');
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

  const handleDownloadAssignment = async (assignmentId) => {
    triggerToast('Downloading assignment file...');
    try {
      const blob = await apiService.downloadAssignmentFile(assignmentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assignment-${assignmentId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error downloading assignment:', e);
      triggerToast('Failed to download assignment file.');
    }
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
      loadCourseMaterials();
    }

    clearInterval(interval);
    setUploadProgress(100);
    setUploadProgressText('Upload completed.');
  };

  const handleTeacherDeleteMaterial = async (materialId) => {
    triggerToast('Deleting course material...');
    try {
      await apiService.deleteMaterial(courseId, materialId);
      triggerToast('Material deleted successfully.');
      loadCourseMaterials();
    } catch (e) {
      triggerToast(getUserFacingError(e, 'Failed to delete material.'));
    }
  };

  const handleTeacherReindexMaterial = async (materialId) => {
    triggerToast('Reindexing course material...');
    try {
      await apiService.reindexMaterial(courseId, materialId);
      triggerToast('Material reindexing triggered.');
      loadCourseMaterials();
    } catch (e) {
      triggerToast(getUserFacingError(e, 'Failed to reindex material.'));
    }
  };

  const handleDownloadMaterial = async (materialId, title) => {
    triggerToast('Downloading material...');
    try {
      const blob = await apiService.downloadMaterialPdf(courseId, materialId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'material'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      triggerToast(getUserFacingError(e, 'Failed to download material.'));
    }
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

  const handleStudentReviewAnswer = async (reviewPayload) => {
    triggerToast('Submitting your feedback...');
    try {
      if (N8N_ENABLED) {
        try {
          const response = await n8nService.submitAnswerReview(reviewPayload);
          triggerToast(response.message || 'Thank you for your feedback.');
        } catch (n8nErr) {
          console.warn('n8n feedback failed, falling back to backend API:', n8nErr);
          await apiService.submitAnswerReview(reviewPayload);
          triggerToast('Thank you for your feedback (fallback).');
        }
      } else {
        await apiService.submitAnswerReview(reviewPayload);
        triggerToast('Thank you for your feedback.');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      triggerToast('Failed to submit feedback.');
    }
  };

  const handleTeacherAnswerEsc = async (escalationId, reply, createKnowledgeCandidate = true, candidateType = 'ACADEMIC_KNOWLEDGE') => {
    triggerToast('Sending answer...');

    try {
      if (N8N_ENABLED) {
        try {
          const payload = {
            questionEscalationId: escalationId,
            teacherId: getTeacherUserId(),
            teacherName: currentUser?.fullName || currentUser?.name || 'Teacher',
            answer: reply,
            createKnowledgeCandidate,
            candidateType
          };
          const response = await n8nService.submitTeacherAnswer(payload);
          triggerToast(response.message || 'Answer sent successfully.');
        } catch (n8nErr) {
          console.warn('n8n teacher answer failed, falling back to backend API:', n8nErr);
          const payload = {
            teacherId: getTeacherUserId(),
            teacherName: currentUser?.fullName || currentUser?.name || 'Teacher',
            answer: reply,
            createKnowledgeCandidate,
            candidateType
          };
          await apiService.answerEscalation(escalationId, payload);
          triggerToast('Answer sent successfully (fallback).');
        }
      } else {
        const payload = {
          teacherId: getTeacherUserId(),
          teacherName: currentUser?.fullName || currentUser?.name || 'Teacher',
          answer: reply,
          createKnowledgeCandidate,
          candidateType
        };
        await apiService.answerEscalation(escalationId, payload);
        triggerToast('Answer sent successfully.');
      }

      setEscalations(prev => prev.map(esc => {
        if (esc.id === escalationId) {
          return { ...esc, status: 'answered' };
        }
        return esc;
      }));
      loadTeacherInbox();
    } catch (error) {
      console.error('Error sending answer:', error);
      triggerToast('Failed to send answer.');
    }
  };

  const handleMentorReviewAnswer = async (review, accurate, feedback) => {
    triggerToast('Submitting AI answer review...');
    try {
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
    } catch (error) {
      console.error('Error submitting mentor review:', error);
      triggerToast('Failed to submit review.');
    }
  };

  const handleSeniorResolveReview = async (reviewId, decision, notes) => {
    triggerToast('Resolving senior review...');
    try {
      await apiService.seniorResolveAnswerReview(reviewId, {
        seniorReviewerId: getTeacherUserId(),
        seniorReviewerName: currentUser?.fullName || currentUser?.name || 'Senior Mentor',
        decision,
        notes
      });
      triggerToast('Senior review resolved.');
      loadAnswerReviews();
    } catch (error) {
      console.error('Error resolving senior review:', error);
      triggerToast('Failed to resolve review.');
    }
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

  const handleApproveCandidate = async (id, reviewNote = 'Approved') => {
    triggerToast('Approving suggested AI answer...');
    try {
      if (N8N_ENABLED) {
        try {
          const payload = {
            decision: 'APPROVE',
            candidateId: id,
            reviewerId: getCurrentUserId(),
            reviewerRole: activeRole === 'admin' ? 'ADMIN' : 'SENIOR_MENTOR',
            reviewerName: currentUser?.fullName || currentUser?.name || 'Senior Mentor',
            reviewNote
          };
          const response = await n8nService.submitSeniorApproval(payload);
          triggerToast(response.message || 'Approved. The answer is ready for AI Tutor knowledge.');
        } catch (n8nErr) {
          console.warn('n8n approval failed, falling back to backend API:', n8nErr);
          await apiService.approveCandidate(id, {
            reviewerId: getCurrentUserId(),
            reviewerRole: activeRole === 'admin' ? 'ADMIN' : 'SENIOR_MENTOR',
            reviewerName: currentUser?.fullName || currentUser?.name || 'Senior Mentor',
            reviewNote
          });
          triggerToast('Approved (fallback).');
        }
      } else {
        await apiService.approveCandidate(id, {
          reviewerId: getCurrentUserId(),
          reviewerRole: activeRole === 'admin' ? 'ADMIN' : 'SENIOR_MENTOR',
          reviewerName: currentUser?.fullName || currentUser?.name || 'Senior Mentor',
          reviewNote
        });
        triggerToast('Approved. The answer is ready for AI Tutor knowledge.');
      }
      setCandidates(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error approving candidate:', error);
      triggerToast('Failed to approve candidate.');
    }
  };

  const handleRejectCandidate = async (id, rejectionReason = 'Rejected by mentor') => {
    triggerToast('Rejecting suggested AI answer...');
    try {
      if (N8N_ENABLED) {
        try {
          const payload = {
            decision: 'REJECT',
            candidateId: id,
            reviewerId: getCurrentUserId(),
            reviewerRole: activeRole === 'admin' ? 'ADMIN' : 'SENIOR_MENTOR',
            reviewerName: currentUser?.fullName || currentUser?.name || 'Senior Mentor',
            rejectionReason
          };
          const response = await n8nService.submitSeniorApproval(payload);
          triggerToast(response.message || 'Suggested AI answer rejected.');
        } catch (n8nErr) {
          console.warn('n8n reject failed, falling back to backend API:', n8nErr);
          await apiService.rejectCandidate(id, {
            reviewerId: getCurrentUserId(),
            reviewerRole: activeRole === 'admin' ? 'ADMIN' : 'SENIOR_MENTOR',
            rejectionReason
          });
          triggerToast('Suggested AI answer rejected (fallback).');
        }
      } else {
        await apiService.rejectCandidate(id, {
          reviewerId: getCurrentUserId(),
          reviewerRole: activeRole === 'admin' ? 'ADMIN' : 'SENIOR_MENTOR',
          rejectionReason
        });
        triggerToast('Suggested AI answer rejected.');
      }
      setCandidates(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error rejecting candidate:', error);
      triggerToast('Failed to reject candidate.');
    }
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
            onLogout={handleLogout}
          />

          {/* MAIN CONTAINER */}
          <div className="main-layout">
        
            {/* SIDEBAR */}
            <Sidebar activeRole={activeRole} activeTab={activeTab} switchTab={setActiveTab} />

            {/* VIEW AREA */}
            <main className="content-wrapper">
              <Suspense fallback={<div className="portal-loading"><Spin tip="Loading workspace..." /></div>}>
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
                  courseMaterials={courseMaterials}
                  onDownloadMaterial={handleDownloadMaterial}
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

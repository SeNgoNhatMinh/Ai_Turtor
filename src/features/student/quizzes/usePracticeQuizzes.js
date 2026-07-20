import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { quizApi } from '../../../services/quizApi';
import { getUserFacingError } from '../../../services/apiClient';
import { quizGateway } from '../../ai-harness/quizGateway';
import {
  asQuizArray,
  getAssignmentId,
  getSuggestionText,
  normalizeQuizStatus,
  sortQuizHistory,
} from './practiceQuizUtils';
import { useMutationLock } from '../../../hooks/useMutationLock';

export function usePracticeQuizzes({
  studentId,
  courseId,
  classId,
  suggestions,
  initialSuggestion,
  triggerToast,
  onAfterQuizSubmit,
}) {
  const [topic, setTopic] = useState(initialSuggestion || '');
  const [questionCount, setQuestionCount] = useState(5);
  const [history, setHistory] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [loadingKey, setLoadingKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('generate');
  const loadRequestRef = useRef({ id: 0, controller: null });
  const { runLocked } = useMutationLock();

  const hasContext = Boolean(studentId && courseId);
  const isLoading = Boolean(loadingKey);

  useEffect(() => {
    if (!initialSuggestion) return undefined;
    const timer = window.setTimeout(() => {
      setTopic(initialSuggestion);
      setActiveTab('generate');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialSuggestion]);

  const suggestionOptions = useMemo(() => {
    const unique = [...new Set(asQuizArray(suggestions).map(getSuggestionText).filter(Boolean))];
    return unique.map((value) => ({
      value,
      label: value.length > 92 ? `${value.slice(0, 92)}...` : value,
    }));
  }, [suggestions]);

  const safeAssigned = useMemo(() => asQuizArray(assigned), [assigned]);
  const sortedHistory = useMemo(() => sortQuizHistory(history), [history]);

  const quizStats = useMemo(() => {
    const inProgress = sortedHistory.filter((item) => normalizeQuizStatus(item.status) === 'GENERATED').length;
    const submitted = sortedHistory.filter((item) => normalizeQuizStatus(item.status) === 'SUBMITTED').length;
    const reviewed = sortedHistory.filter((item) => (
      normalizeQuizStatus(item.teacherReviewStatus || item.reviewStatus).includes('REVIEWED')
    )).length;
    const latestQuiz = sortedHistory[0];
    return {
      assigned: safeAssigned.length,
      inProgress,
      submitted,
      reviewed,
      latest: latestQuiz?.updatedAt || latestQuiz?.submittedAt || latestQuiz?.createdAt,
    };
  }, [safeAssigned.length, sortedHistory]);

  const loadQuizzes = useCallback(async () => {
    if (!hasContext) {
      setHistory([]);
      setAssigned([]);
      return;
    }
    loadRequestRef.current.controller?.abort();
    const controller = new AbortController();
    const requestId = loadRequestRef.current.id + 1;
    loadRequestRef.current = { id: requestId, controller };
    setLoadingKey('refresh');
    setError('');
    try {
      const [historyData, assignedData] = await Promise.all([
        quizApi.getStudentQuizHistory(studentId, courseId, { signal: controller.signal, force: true }),
        quizApi.getAssignedQuizzes(studentId, courseId, classId, { signal: controller.signal, force: true }),
      ]);
      if (loadRequestRef.current.id !== requestId) return;
      setHistory(asQuizArray(historyData));
      setAssigned(asQuizArray(assignedData));
    } catch (requestError) {
      if (controller.signal.aborted || loadRequestRef.current.id !== requestId) return;
      setError(getUserFacingError(requestError, 'Không thể tải danh sách quiz.'));
    } finally {
      if (loadRequestRef.current.id === requestId) {
        loadRequestRef.current.controller = null;
        setLoadingKey('');
      }
    }
  }, [classId, courseId, hasContext, studentId]);

  useEffect(() => {
    const timer = window.setTimeout(loadQuizzes, 0);
    return () => window.clearTimeout(timer);
  }, [loadQuizzes]);

  useEffect(() => () => loadRequestRef.current.controller?.abort(), []);

  const generateQuiz = useCallback(async (overrideTopic = '') => {
    const selectedTopic = String(overrideTopic || topic || '').trim();
    if (!hasContext) {
      setError('Hãy chọn môn học trước khi tạo quiz.');
      return;
    }
    if (!selectedTopic) {
      triggerToast?.('Hãy chọn chủ đề hoặc gợi ý học tập trước.');
      return;
    }

    return runLocked('quiz:generate', async () => {
      setLoadingKey('generate');
      setError('');
      setLastResult(null);
      try {
        const quiz = await quizGateway.generateStudentQuiz({
          studentId,
          courseId,
          classId,
          payload: { topic: selectedTopic, suggestionText: selectedTopic, questionCount },
        });
        setTopic(selectedTopic);
        setActiveQuiz(quiz);
        setActiveTab('active');
        await loadQuizzes();
      } catch (requestError) {
        setError(getUserFacingError(
          requestError,
          'Chưa đủ học liệu đã lập chỉ mục để tạo quiz. Hãy tải lên hoặc lập chỉ mục lại học liệu trước.',
        ));
      } finally {
        setLoadingKey('');
      }
    });
  }, [classId, courseId, hasContext, loadQuizzes, questionCount, runLocked, studentId, topic, triggerToast]);

  const startAssignedQuiz = useCallback(async (assignment) => {
    const assignmentId = getAssignmentId(assignment);
    if (!assignmentId || !studentId) return;
    return runLocked(`quiz:assignment:${assignmentId}`, async () => {
      setLoadingKey(`assignment:${assignmentId}`);
      setError('');
      setLastResult(null);
      try {
        const quiz = await quizApi.startQuizAssignmentAttempt(assignmentId, studentId);
        setActiveQuiz(quiz);
        setActiveTab('active');
      } catch (requestError) {
        setError(getUserFacingError(requestError, 'Không thể bắt đầu quiz được giao.'));
      } finally {
        setLoadingKey('');
      }
    });
  }, [runLocked, studentId]);

  const submitQuiz = useCallback(async (quizSessionId, payload) => {
    return runLocked(`quiz:submit:${quizSessionId}`, async () => {
      setSubmitting(true);
      setError('');
      try {
        const result = await quizGateway.submitStudentQuiz({
          quizSessionId,
          studentId,
          courseId,
          classId,
          payload,
        });
        setLastResult(result);
        setActiveQuiz(null);
        setActiveTab('result');
        await loadQuizzes();
        onAfterQuizSubmit?.();
        triggerToast?.('Đã nộp quiz.');
      } catch (requestError) {
        triggerToast?.(getUserFacingError(requestError, 'Không thể nộp quiz.'));
      } finally {
        setSubmitting(false);
      }
    });
  }, [classId, courseId, loadQuizzes, onAfterQuizSubmit, runLocked, studentId, triggerToast]);

  const viewQuizHistory = useCallback(async (quizId, status) => {
    if (!quizId) return;
    setLoadingKey(`quiz:${quizId}`);
    setError('');
    try {
      const quiz = await quizApi.getQuiz(quizId);
      if (normalizeQuizStatus(status) === 'GENERATED' || normalizeQuizStatus(quiz.status) === 'GENERATED') {
        setActiveQuiz(quiz);
        setLastResult(null);
        setActiveTab('active');
      } else {
        setLastResult(quiz);
        setActiveQuiz(null);
        setActiveTab('result');
      }
    } catch (requestError) {
      setError(getUserFacingError(requestError, 'Không thể tải chi tiết quiz.'));
    } finally {
      setLoadingKey('');
    }
  }, []);

  const retryFromResult = useCallback(() => {
    const retryTopic = lastResult?.topic || lastResult?.suggestionText || topic;
    if (retryTopic) generateQuiz(retryTopic);
  }, [generateQuiz, lastResult, topic]);

  return {
    topic,
    setTopic,
    questionCount,
    setQuestionCount,
    assigned: safeAssigned,
    history: sortedHistory,
    activeQuiz,
    lastResult,
    loadingKey,
    submitting,
    error,
    activeTab,
    setActiveTab,
    hasContext,
    isLoading,
    suggestionOptions,
    quizStats,
    loadQuizzes,
    generateQuiz,
    startAssignedQuiz,
    submitQuiz,
    viewQuizHistory,
    retryFromResult,
  };
}

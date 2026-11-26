import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import LogRocket from '@/utils/logRocket';
import { queryKeys } from '../../../app/queryKeys';
import { quizApi } from '../../../services/quizApi';
import { getUserFacingError } from '../../../services/apiClient';
import { quizGateway } from '../../ai-harness/quizGateway';
import {
  asQuizArray,
  getSuggestionText,
  normalizeQuizQuestionCount,
  normalizeQuizStatus,
  sortQuizHistory,
} from './practiceQuizUtils';
import { useMutationLock } from '../../../hooks/useMutationLock';
import { useRealtimeEvent, useRealtimeReconnect } from '../../realtime/realtimeContext';
import { REALTIME_EVENT_TYPES } from '../../realtime/realtimeEvents';

const EMPTY_LIST = [];

const normalizeTopic = (value) => {
  const normalized = String(value || '').trim();
  return /^\\+$/.test(normalized) ? '' : normalized;
};

const buildQuizTopic = (suggestedTopic, customTopic) => {
  const suggestion = normalizeTopic(suggestedTopic);
  const custom = normalizeTopic(customTopic);
  if (!suggestion) return custom;
  if (!custom || custom.toLocaleLowerCase('vi-VN') === suggestion.toLocaleLowerCase('vi-VN')) {
    return suggestion;
  }
  return `${suggestion}. Trọng tâm: ${custom}`;
};

export function usePracticeQuizzes({
  studentId,
  courseId,
  classId,
  suggestions,
  initialSuggestion,
  triggerToast,
  onAfterQuizSubmit,
}) {
  const [suggestedTopic, setSuggestedTopic] = useState(() => normalizeTopic(initialSuggestion));
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [loadingKey, setLoadingKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('generate');
  const { runLocked } = useMutationLock();
  const queryClient = useQueryClient();

  const hasContext = Boolean(studentId && courseId);
  const historyQuery = useQuery({
    queryKey: queryKeys.studentQuizHistory(studentId, courseId),
    queryFn: ({ signal }) => quizApi.getStudentQuizHistory(studentId, courseId, { signal }),
    enabled: hasContext,
    staleTime: 15_000,
    retry: 1,
  });
  const history = historyQuery.data || EMPTY_LIST;
  const isLoading = Boolean(loadingKey) || historyQuery.isFetching;

  useEffect(() => {
    if (!initialSuggestion) return undefined;
    const timer = window.setTimeout(() => {
      setSuggestedTopic(normalizeTopic(initialSuggestion));
      setTopic('');
      setActiveTab('generate');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialSuggestion]);

  const suggestionOptions = useMemo(() => {
    const unique = [...new Set(
      asQuizArray(suggestions)
        .map(getSuggestionText)
        .map(normalizeTopic)
        .filter(Boolean),
    )];
    return unique.map((value) => ({
      value,
      label: value.length > 92 ? `${value.slice(0, 92)}...` : value,
    }));
  }, [suggestions]);

  const sortedHistory = useMemo(() => sortQuizHistory(history), [history]);

  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || activeQuiz || !sortedHistory.length) return;
    const inProgress = sortedHistory.find((item) => normalizeQuizStatus(item.status) === 'GENERATED');
    if (!inProgress) return;
    restoredRef.current = true;
    const quizId = inProgress.quizSessionId || inProgress.id;
    if (!quizId) return;
    queryClient.fetchQuery({
      queryKey: queryKeys.quizDetail(quizId),
      queryFn: ({ signal }) => quizApi.getQuiz(quizId, { signal }),
      staleTime: 15_000,
    }).then((fullQuiz) => {
      if (normalizeQuizStatus(fullQuiz.status) === 'GENERATED') {
        setActiveQuiz(fullQuiz);
      }
    }).catch(() => {});
  }, [activeQuiz, queryClient, sortedHistory]);

  const quizStats = useMemo(() => {
    const inProgress = sortedHistory.filter((item) => normalizeQuizStatus(item.status) === 'GENERATED').length;
    const submitted = sortedHistory.filter((item) => normalizeQuizStatus(item.status) === 'SUBMITTED').length;
    const reviewed = sortedHistory.filter((item) => (
      normalizeQuizStatus(item.teacherReviewStatus || item.reviewStatus).includes('REVIEWED')
    )).length;
    const latestQuiz = sortedHistory[0];
    return {
      inProgress,
      submitted,
      reviewed,
      latest: latestQuiz?.updatedAt || latestQuiz?.submittedAt || latestQuiz?.createdAt,
    };
  }, [sortedHistory]);

  const refetchHistory = historyQuery.refetch;

  useRealtimeEvent(REALTIME_EVENT_TYPES.quizHistory, () => {
    if (hasContext) refetchHistory();
  });
  useRealtimeReconnect(() => {
    if (hasContext) refetchHistory();
  });

  const loadQuizzes = useCallback(async () => {
    if (!hasContext) return [];
    setLoadingKey('refresh');
    setError('');
    try {
      const historyResult = await refetchHistory({ throwOnError: true });
      return historyResult.data || [];
    } catch (requestError) {
      setError(getUserFacingError(requestError, 'Không thể tải danh sách quiz.'));
    } finally {
      setLoadingKey('');
    }
    return [];
  }, [hasContext, refetchHistory]);

  const generateQuiz = useCallback(async (overrideTopic = '') => {
    const selectedTopic = normalizeTopic(overrideTopic) || buildQuizTopic(suggestedTopic, topic);
    if (!hasContext) {
      setError('Hãy chọn môn học trước khi tạo quiz.');
      return;
    }
    if (!selectedTopic) {
      triggerToast?.('Hãy chọn chủ đề hoặc gợi ý học tập trước.');
      return;
    }

    return runLocked('quiz:generate', async () => {
      const requestedQuestionCount = normalizeQuizQuestionCount(questionCount);
      setQuestionCount(requestedQuestionCount);
      setLoadingKey('generate');
      setError('');
      setLastResult(null);
      try {
        const quiz = await quizGateway.generateStudentQuiz({
          studentId,
          courseId,
          classId,
          payload: {
            topic: selectedTopic,
            suggestionText: selectedTopic,
            questionCount: requestedQuestionCount,
          },
        });
        const generatedQuestionCount = Array.isArray(quiz?.questions) ? quiz.questions.length : 0;
        if (generatedQuestionCount > 0 && generatedQuestionCount !== requestedQuestionCount) {
          triggerToast?.(
            `Quiz chỉ có ${generatedQuestionCount}/${requestedQuestionCount} câu hợp lệ. `
            + 'Hệ thống đã loại câu không đạt yêu cầu.',
          );
        }
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
  }, [classId, courseId, hasContext, loadQuizzes, questionCount, runLocked, studentId, suggestedTopic, topic, triggerToast]);

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
        LogRocket.track('QuizSubmitted', { courseId, classId });
        triggerToast?.('Đã nộp quiz.');
      } catch (requestError) {
        triggerToast?.(getUserFacingError(requestError, 'Không thể nộp quiz.'), 'error');
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
      const quiz = await queryClient.fetchQuery({
        queryKey: queryKeys.quizDetail(quizId),
        queryFn: ({ signal }) => quizApi.getQuiz(quizId, { signal }),
        staleTime: 15_000,
      });
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
  }, [queryClient]);

  const retryFromResult = useCallback(() => {
    const retryTopic = lastResult?.topic
      || lastResult?.suggestionText
      || buildQuizTopic(suggestedTopic, topic);
    if (retryTopic) generateQuiz(retryTopic);
  }, [generateQuiz, lastResult, suggestedTopic, topic]);

  return {
    topic,
    setTopic,
    suggestedTopic,
    setSuggestedTopic,
    questionCount,
    setQuestionCount,
    history: sortedHistory,
    activeQuiz,
    lastResult,
    loadingKey,
    submitting,
    error: error || (historyQuery.error
      ? getUserFacingError(historyQuery.error, 'Không thể tải danh sách quiz.')
      : ''),
    activeTab,
    setActiveTab,
    hasContext,
    isLoading,
    suggestionOptions,
    quizStats,
    loadQuizzes,
    generateQuiz,
    submitQuiz,
    viewQuizHistory,
    retryFromResult,
  };
}

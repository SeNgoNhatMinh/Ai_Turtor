import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { confirmAction } from '../../../components/common/confirmDialog';
import { materialsApi } from '../../../services/materialsApi';
import { supportChatApi } from '../../../services/supportChatApi';
import { getUserFacingError } from '../../../services/apiClient';
import { classIdMatches } from '../../../utils/academicIds';
import { LIMITS, validateChatInput } from '../../../utils/validators';
import { isMobileViewport } from '../../../hooks/useResponsiveViewport';
import { uiCopy } from '../../../constants/uiCopy';
import { readStudentOwnLlm } from './studentOwnLlm';
import {
  buildIncorrectAnswersRemediationPrompt,
  buildIncorrectAnswerRemediationPrompt,
  buildMissingAnswerKeyRemediationPrompt,
  extractUnderstandingCheck,
} from './understandingCheck';

export function useStudentChatTabController({
  courseId,
  setCourseId,
  classId,
  courseOptions = [],
  classOptions = [],
  sessions = [],
  activeSessionId,
  messages = [],
  courseDailyQuotaExhausted = false,
  turnLimitNotice,
  dismissTurnLimitNotice,
  resetChat,
  handleSelectSession,
  handleRenameSession,
  handleSendQuery,
  handleLockUnderstandingAnswer,
  handleStopAiGeneration,
  switchTab,
  onOpenMentorReview,
  userId,
  studentDashboard,
  loadEscalations,
  triggerToast,
}) {
  const [chatInput, setChatInput] = useState('');
  const [chatMode, setChatMode] = useState('RAG');
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(() => !isMobileViewport());
  const isAiLoadingRef = useRef(false);
  const pendingRemediationRef = useRef([]);
  const understandingCheckProgressRef = useRef(new Map());
  const messagesEndRef = useRef(null);

  // Switching to a phone viewport (resize / device toolbar) closes the
  // history pane completely instead of leaving it open over the chat.
  useEffect(() => {
    const mediaQuery = window.matchMedia(
      '(max-width: 767px), (max-width: 1023px) and (hover: none) and (pointer: coarse)',
    );
    const closeOnMobile = (event) => {
      if (event.matches) setIsHistoryDrawerOpen(false);
    };
    mediaQuery.addEventListener('change', closeOnMobile);
    return () => mediaQuery.removeEventListener('change', closeOnMobile);
  }, []);
  const previousMessageCountRef = useRef(0);
  const previousSessionIdRef = useRef('');

  useLayoutEffect(() => {
    const marker = messagesEndRef.current;
    const container = marker?.closest('.chat-workspace-messages-container');
    const messageCount = Array.isArray(messages) ? messages.length : 0;
    if (!container) return;
    const sessionChanged = previousSessionIdRef.current !== activeSessionId;
    const scrollContainer = (top, behavior) => {
      if (typeof container.scrollTo === 'function') container.scrollTo({ top, behavior });
      else container.scrollTop = top;
    };

    if (messageCount === 0) {
      scrollContainer(0, 'auto');
      previousMessageCountRef.current = 0;
      previousSessionIdRef.current = activeSessionId;
      return;
    }

    const firstLoad = sessionChanged || previousMessageCountRef.current === 0;
    // In-place updates (grading a quiz answer, pinning, feedback) keep the
    // count: leave the student where they are reading.
    if (firstLoad || messageCount > previousMessageCountRef.current) {
      scrollContainer(container.scrollHeight, firstLoad ? 'auto' : 'smooth');
    }
    previousMessageCountRef.current = messageCount;
    previousSessionIdRef.current = activeSessionId;
  }, [activeSessionId, messages]);

  const onSaveRename = async (event, sessionId) => {
    event.stopPropagation();
    if (editingSessionTitle.trim()) {
      const succeeded = await handleRenameSession(sessionId, editingSessionTitle.trim());
      if (!succeeded) return;
    }
    setEditingSessionId(null);
  };

  const applyCourseChange = (nextCourseId) => {
    if (!nextCourseId || nextCourseId === courseId) return;
    dismissTurnLimitNotice?.();
    resetChat?.();
    setChatMode('RAG');
    setCourseId(nextCourseId);
  };

  const handleCourseChange = (nextCourseId, options = {}) => {
    if (!nextCourseId || nextCourseId === courseId) return;
    if (options.confirmed) {
      applyCourseChange(nextCourseId);
      return;
    }
    const hasActiveChat = Boolean(activeSessionId) || (Array.isArray(messages) && messages.length > 0);
    if (!hasActiveChat) {
      applyCourseChange(nextCourseId);
      return;
    }

    confirmAction({
      title: 'Đổi môn học?',
      content: 'Mỗi môn có lịch sử trò chuyện riêng. Hệ thống sẽ mở lịch sử của môn mới.',
      okText: 'Đổi môn',
      cancelText: 'Hủy',
      onOk: () => applyCourseChange(nextCourseId),
    });
  };

  const handleBackToPreviousChat = () => {
    const previousSessionId = turnLimitNotice?.previousSessionId;
    if (!previousSessionId) return;
    const previousSession = sessions.find((session) => session.id === previousSessionId);
    handleSelectSession(previousSessionId, previousSession?.title || 'Cuộc trò chuyện trước');
  };

  const sendText = (text, requestContext = {}) => {
    if (isAiLoadingRef.current) return;
    if (!userId) {
      triggerToast?.('Vui lòng đăng nhập trước khi gửi tin nhắn.');
      return;
    }

    const hasCourseOptions = Array.isArray(courseOptions) && courseOptions.length > 0;
    const hasValidCourse = hasCourseOptions && courseOptions.some((item) => item?.value === courseId);
    if (!hasValidCourse) {
      triggerToast?.('Tài khoản chưa được ghi danh vào môn học. Vui lòng liên hệ Admin hoặc giáo viên.');
      return;
    }

    const hasClassOptions = Array.isArray(classOptions) && classOptions.length > 0;
    const hasValidClass = hasClassOptions && classOptions.some((item) => (
      item?.value === classId
      || classIdMatches(item?.value, classId)
      || (Array.isArray(item?.aliases) && item.aliases.some((alias) => classIdMatches(alias, classId)))
    ));
    if (!hasValidClass) {
      triggerToast?.('Tài khoản chưa được xếp lớp cho môn này. Vui lòng liên hệ Admin hoặc giáo viên.');
      return;
    }

    if (courseDailyQuotaExhausted && !readStudentOwnLlm(userId)) {
      triggerToast?.(uiCopy.student.chat.full);
      return;
    }

    const validation = validateChatInput(text);
    if (!validation.ok) {
      triggerToast?.(validation.message);
      return;
    }

    const textToSend = validation.value;
    setChatInput('');
    isAiLoadingRef.current = true;
    setIsAiLoading(true);
    const effectiveRequestContext = {
      ...requestContext,
      requestedMode: requestContext.requestedMode || chatMode,
    };
    handleSendQuery(textToSend, '', () => {}, effectiveRequestContext).finally(() => {
      isAiLoadingRef.current = false;
      setIsAiLoading(false);
    });
  };

  useEffect(() => {
    if (isAiLoading || isAiLoadingRef.current) return;
    const nextRemediation = pendingRemediationRef.current.shift();
    if (nextRemediation) sendText(nextRemediation.prompt, nextRemediation.context);
  }, [isAiLoading, sendText]);

  const handleUnderstandingCheckAnswer = async (answerMessage, selectedKey, attempt = {}) => {
    const grade = await handleLockUnderstandingAnswer?.(answerMessage, selectedKey, attempt);
    if (!grade) {
      triggerToast?.('Không thể lưu lần trả lời. Vui lòng thử lại.');
      return;
    }
    const quizIndex = Number.isInteger(attempt.quizIndex) ? attempt.quizIndex : 0;
    const messageId = grade.messageId
      || answerMessage?.assistantMessageId
      || answerMessage?.messageId
      || answerMessage?.id
      || answerMessage?.clientMessageId
      || '';
    const progressKey = String(messageId || `understanding-check-${attempt.quiz?.question || ''}`);
    const answerMarkdown = answerMessage?.answer || answerMessage?.rawAnswer || answerMessage?.content || '';
    const extractedQuizzes = extractUnderstandingCheck(answerMarkdown).quizzes;
    const savedAttempts = Array.isArray(answerMessage?.understandingCheckAttempts)
      ? answerMessage.understandingCheckAttempts : [];
    const expectedCount = Math.max(
      extractedQuizzes.length,
      savedAttempts.length,
      quizIndex + 1,
      1,
    );
    const progress = understandingCheckProgressRef.current.get(progressKey) || {
      expectedCount,
      answers: new Map(),
      remediationStarted: false,
    };
    progress.expectedCount = Math.max(progress.expectedCount, expectedCount);

    savedAttempts.forEach((savedAttempt) => {
      const savedIndex = Number(savedAttempt?.quizIndex ?? -1);
      const savedKey = String(savedAttempt?.selectedKey || '').trim().toUpperCase();
      if (savedIndex < 0 || !savedKey || progress.answers.has(savedIndex)) return;
      const quiz = extractedQuizzes[savedIndex]
        || savedAttempt?.check
        || (savedIndex === 0 ? answerMessage?.understandingCheck : null);
      const selected = (Array.isArray(quiz?.options) ? quiz.options : [])
        .find((option) => String(option?.key || '').toUpperCase() === savedKey);
      if (!quiz?.question || !selected) return;
      const correctKey = String(quiz.correctKey || '').trim().toUpperCase();
      const correct = typeof savedAttempt?.correct === 'boolean'
        ? savedAttempt.correct
        : (correctKey ? savedKey === correctKey : undefined);
      progress.answers.set(savedIndex, {
        quizIndex: savedIndex,
        quiz: { ...quiz, correctKey, explanation: quiz.explanation || '' },
        selected,
        grade: {
          correct,
          correctKey,
          explanation: quiz.explanation || '',
          messageId,
          attemptId: savedAttempt?.attemptId || '',
        },
      });
    });

    const quiz = {
      ...(attempt.quiz || {}),
      correctKey: grade.correctKey || attempt.quiz?.correctKey || '',
      explanation: grade.explanation || attempt.quiz?.explanation || '',
    };
    progress.answers.set(quizIndex, {
      quizIndex,
      quiz,
      selected: attempt.selected,
      grade: { ...grade, messageId },
    });
    understandingCheckProgressRef.current.set(progressKey, progress);

    if (progress.remediationStarted || progress.answers.size < progress.expectedCount) return grade;
    progress.remediationStarted = true;

    const incorrectAnswers = [...progress.answers.values()]
      .filter((entry) => {
        const correctKey = String(entry.grade?.correctKey || entry.quiz.correctKey || '').toUpperCase();
        return entry.grade?.correct === false
          || (correctKey && String(entry.selected?.key || '').toUpperCase() !== correctKey)
          || !correctKey;
      })
      .sort((left, right) => left.quizIndex - right.quizIndex);
    if (!incorrectAnswers.length) return grade;

    const remediationPrompt = incorrectAnswers.length === 1
      ? (incorrectAnswers[0].quiz.correctKey
        ? buildIncorrectAnswerRemediationPrompt(incorrectAnswers[0].quiz, incorrectAnswers[0].selected)
        : buildMissingAnswerKeyRemediationPrompt(incorrectAnswers[0].quiz, incorrectAnswers[0].selected))
      : buildIncorrectAnswersRemediationPrompt(incorrectAnswers);
    if (!remediationPrompt) return grade;

    const firstIncorrect = incorrectAnswers[0];
    const remediationContext = {
      interactionType: 'UNDERSTANDING_REMEDIATION',
      displayQuestion: incorrectAnswers.length === 1
        ? firstIncorrect.quiz.question
        : `Giảng lại ${incorrectAnswers.length} câu trả lời chưa đúng trong quiz`,
      originAssistantMessageId: firstIncorrect.grade.messageId || messageId,
      understandingAttemptId: firstIncorrect.grade.attemptId || '',
      originalQuestion: firstIncorrect.quiz.question || '',
    };
    triggerToast?.('AI Tutor đang giảng lại các câu sai trong quiz.');
    if (isAiLoadingRef.current) {
      pendingRemediationRef.current.push({ prompt: remediationPrompt, context: remediationContext });
    } else {
      sendText(remediationPrompt, remediationContext);
    }
    return grade;
  };

  const setChatDraft = (text) => {
    setChatInput(String(text || '').slice(0, LIMITS.chatMax));
    globalThis.requestAnimationFrame?.(() => {
      document.querySelector('[data-chat-composer-input="true"]')?.focus();
    });
  };

  const handleAnswerAction = async ({ prompt, type, message: answerMessage }) => {
    if (type === 'retry') {
      const retryText = String(answerMessage?.question || prompt || '').trim();
      if (!retryText) {
        triggerToast?.('Không có câu hỏi để thử lại.');
        return;
      }
      sendText(retryText);
      return;
    }

    if (type === 'mentor') {
      try {
        const escalation = await supportChatApi.createEscalation({
          studentId: userId,
          studentName: studentDashboard?.studentName || studentDashboard?.fullName || '',
          studentEmail: studentDashboard?.studentEmail || '',
          courseId,
          classId,
          conversationId: activeSessionId || answerMessage?.conversationId || '',
          question: answerMessage?.question || prompt,
          aiResponse: answerMessage?.rawAnswer || answerMessage?.answer || '',
          reason: answerMessage?.aiServiceError
            ? 'AI Tutor could not reach the language model.'
            : 'Student requested mentor support from AI Tutor chat.',
        });
        triggerToast?.('Đã gửi yêu cầu hỗ trợ cho mentor.');
        loadEscalations?.();
        if (onOpenMentorReview) {
          onOpenMentorReview(escalation?.questionEscalationId || escalation?.id || escalation?.escalationId);
        } else {
          switchTab?.('student-escalation');
        }
      } catch (error) {
        triggerToast?.(getUserFacingError(error, 'Không thể tạo yêu cầu hỗ trợ.'));
      }
      return;
    }

    sendText(prompt);
  };

  const onSendQuery = () => {
    sendText(chatInput);
  };

  const onStopQuery = () => {
    handleStopAiGeneration?.();
    isAiLoadingRef.current = false;
    setIsAiLoading(false);
  };

  const handleDownloadSource = async (materialId, title) => {
    if (!userId || !courseId || !classId || !materialId) return;
    message.loading({ content: 'Đang tải tài liệu...', key: 'dl' });
    try {
      const blob = await materialsApi.downloadStudentClassMaterialPdf(
        userId,
        courseId,
        classId,
        materialId,
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title || 'material'}.pdf`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      message.success({ content: 'Đã tải tài liệu.', key: 'dl' });
    } catch {
      message.error({ content: 'Không thể tải tệp. Tài liệu này có thể được nhập từ website.', key: 'dl' });
    }
  };

  return {
    chatInput,
    setChatInput,
    chatMode,
    setChatMode,
    editingSessionId,
    editingSessionTitle,
    setEditingSessionId,
    setEditingSessionTitle,
    isAiLoading,
    isHistoryDrawerOpen,
    setIsHistoryDrawerOpen,
    messagesEndRef,
    onSaveRename,
    handleCourseChange,
    handleBackToPreviousChat,
    sendText,
    setChatDraft,
    onSendQuery,
    onStopQuery,
    handleUnderstandingCheckAnswer,
    handleAnswerAction,
    handleDownloadSource,
  };
}

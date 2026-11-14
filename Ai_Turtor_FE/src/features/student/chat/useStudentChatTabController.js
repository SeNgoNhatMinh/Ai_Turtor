import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { message } from 'antd';
import LogRocket from 'logrocket';
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
  getActiveChatGeneration,
  subscribeActiveChatGeneration,
} from './activeChatGeneration';

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
  const [isAiLoading, setIsAiLoading] = useState(() => {
    const run = getActiveChatGeneration();
    return Boolean(run && run.status === 'running' && run.userId === userId && run.courseId === courseId);
  });
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(() => !isMobileViewport());
  const isAiLoadingRef = useRef(isAiLoading);
  useEffect(() => subscribeActiveChatGeneration((run) => {
    const mine = Boolean(
      run && run.status === 'running' && run.userId === userId && run.courseId === courseId,
    );
    isAiLoadingRef.current = mine;
    setIsAiLoading(mine);
  }), [courseId, userId]);
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

  const sendText = useCallback((text, requestContext = {}) => {
    if (isAiLoadingRef.current) return false;
    if (!userId) {
      triggerToast?.('Vui lòng đăng nhập trước khi gửi tin nhắn.');
      return false;
    }

    const hasCourseOptions = Array.isArray(courseOptions) && courseOptions.length > 0;
    const hasValidCourse = hasCourseOptions && courseOptions.some((item) => item?.value === courseId);
    if (!hasValidCourse) {
      triggerToast?.('Tài khoản chưa được ghi danh vào môn học. Vui lòng liên hệ Admin hoặc giáo viên.');
      return false;
    }

    const hasClassOptions = Array.isArray(classOptions) && classOptions.length > 0;
    const hasValidClass = hasClassOptions && classOptions.some((item) => (
      item?.value === classId
      || classIdMatches(item?.value, classId)
      || (Array.isArray(item?.aliases) && item.aliases.some((alias) => classIdMatches(alias, classId)))
    ));
    if (!hasValidClass) {
      triggerToast?.('Tài khoản chưa được xếp lớp cho môn này. Vui lòng liên hệ Admin hoặc giáo viên.');
      return false;
    }

    if (courseDailyQuotaExhausted && !readStudentOwnLlm(userId)) {
      triggerToast?.(uiCopy.student.chat.full);
      return false;
    }

    const validation = validateChatInput(text);
    if (!validation.ok) {
      triggerToast?.(validation.message);
      return false;
    }

    const textToSend = validation.value;
    setChatInput('');
    isAiLoadingRef.current = true;
    setIsAiLoading(true);
    LogRocket.track('ChatMessageSent', { courseId, classId });
    const effectiveRequestContext = {
      ...requestContext,
      requestedMode: requestContext.requestedMode || chatMode,
    };
    handleSendQuery(textToSend, '', () => {}, effectiveRequestContext).finally(() => {
      const run = getActiveChatGeneration();
      const stillRunning = Boolean(
        run && run.status === 'running' && run.userId === userId && run.courseId === courseId,
      );
      if (stillRunning) return;
      isAiLoadingRef.current = false;
      setIsAiLoading(false);
    });
    return true;
  }, [
    chatMode,
    classId,
    classOptions,
    courseDailyQuotaExhausted,
    courseId,
    courseOptions,
    handleSendQuery,
    triggerToast,
    userId,
  ]);

  const handleUnderstandingCheckAnswer = async (answerMessage, selectedKey, attempt = {}) => {
    const grade = await handleLockUnderstandingAnswer?.(answerMessage, selectedKey, attempt);
    if (!grade) {
      triggerToast?.('Không thể lưu lần trả lời. Vui lòng thử lại.', 'error');
      return undefined;
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
        triggerToast?.(getUserFacingError(error, 'Không thể tạo yêu cầu hỗ trợ.'), 'error');
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

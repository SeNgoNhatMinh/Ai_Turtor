import { useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { confirmAction } from '../../../components/common/confirmDialog';
import { materialsApi } from '../../../services/materialsApi';
import { supportChatApi } from '../../../services/supportChatApi';
import { getUserFacingError } from '../../../services/apiClient';
import { classIdMatches } from '../../../utils/academicIds';
import { validateChatInput } from '../../../utils/validators';

export function useStudentChatTabController({
  courseId,
  setCourseId,
  classId,
  courseOptions = [],
  classOptions = [],
  sessions = [],
  activeSessionId,
  messages = [],
  activeSessionMaxTurnsReached = false,
  turnLimitNotice,
  dismissTurnLimitNotice,
  resetChat,
  handleSelectSession,
  handleRenameSession,
  handleSendQuery,
  handleStopAiGeneration,
  switchTab,
  userId,
  studentDashboard,
  loadEscalations,
  triggerToast,
}) {
  const [chatInput, setChatInput] = useState('');
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const previousMessageCountRef = useRef(0);

  useEffect(() => {
    const marker = messagesEndRef.current;
    const container = marker?.closest('.chat-workspace-messages-container');
    const messageCount = Array.isArray(messages) ? messages.length : 0;
    if (!container) return;
    const scrollContainer = (top, behavior) => {
      if (typeof container.scrollTo === 'function') container.scrollTo({ top, behavior });
      else container.scrollTop = top;
    };

    if (messageCount === 0) {
      scrollContainer(0, 'auto');
      previousMessageCountRef.current = 0;
      return;
    }

    scrollContainer(
      container.scrollHeight,
      previousMessageCountRef.current === 0 ? 'auto' : 'smooth',
    );
    previousMessageCountRef.current = messageCount;
  }, [messages]);

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

  const sendText = (text) => {
    if (isAiLoading) return;
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

    if (activeSessionMaxTurnsReached) {
      triggerToast?.('Cuộc trò chuyện đã đủ 10 câu hỏi. Hãy tạo cuộc trò chuyện mới.');
      return;
    }

    const validation = validateChatInput(text);
    if (!validation.ok) {
      triggerToast?.(validation.message);
      return;
    }

    const textToSend = validation.value;
    setChatInput('');
    setIsAiLoading(true);
    handleSendQuery(textToSend, '', () => {}).finally(() => {
      setIsAiLoading(false);
    });
  };

  const handlePromptStarter = (prompt) => {
    sendText(prompt);
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
        await supportChatApi.createEscalation({
          studentId: userId,
          studentName: studentDashboard?.studentName || studentDashboard?.fullName || '',
          studentEmail: studentDashboard?.studentEmail || '',
          courseId,
          classId,
          question: answerMessage?.question || prompt,
          aiResponse: answerMessage?.rawAnswer || answerMessage?.answer || '',
          reason: answerMessage?.aiServiceError
            ? 'AI Tutor could not reach the language model.'
            : 'Student requested mentor support from AI Tutor chat.',
        });
        triggerToast?.('Đã gửi yêu cầu hỗ trợ cho mentor.');
        loadEscalations?.();
        switchTab?.('student-escalation');
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
    setIsAiLoading(false);
  };

  const handleDownloadSource = async (materialId, title) => {
    if (!courseId || !materialId) return;
    message.loading({ content: 'Đang tải tài liệu...', key: 'dl' });
    try {
      const blob = await materialsApi.downloadMaterialPdf(courseId, materialId);
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
    onSendQuery,
    onStopQuery,
    handlePromptStarter,
    handleAnswerAction,
    handleDownloadSource,
  };
}

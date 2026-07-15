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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const onSaveRename = (event, sessionId) => {
    event.stopPropagation();
    if (editingSessionTitle.trim()) {
      handleRenameSession(sessionId, editingSessionTitle.trim());
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
      title: 'Switch course?',
      content: "Each course has separate chat history. Switching course will open that course's conversations.",
      okText: 'Switch course',
      cancelText: 'Cancel',
      onOk: () => applyCourseChange(nextCourseId),
    });
  };

  const handleBackToPreviousChat = () => {
    const previousSessionId = turnLimitNotice?.previousSessionId;
    if (!previousSessionId) return;
    const previousSession = sessions.find((session) => session.id === previousSessionId);
    handleSelectSession(previousSessionId, previousSession?.title || 'Previous conversation');
  };

  const sendText = (text) => {
    if (isAiLoading) return;
    if (!userId) {
      triggerToast?.('Please sign in before sending a message.');
      return;
    }

    const hasCourseOptions = Array.isArray(courseOptions) && courseOptions.length > 0;
    const hasValidCourse = hasCourseOptions && courseOptions.some((item) => item?.value === courseId);
    if (!hasValidCourse) {
      triggerToast?.('Your account is not enrolled in any course yet. Please contact Admin or your teacher.');
      return;
    }

    const hasClassOptions = Array.isArray(classOptions) && classOptions.length > 0;
    const hasValidClass = hasClassOptions && classOptions.some((item) => (
      item?.value === classId
      || classIdMatches(item?.value, classId)
      || (Array.isArray(item?.aliases) && item.aliases.some((alias) => classIdMatches(alias, classId)))
    ));
    if (!hasValidClass) {
      triggerToast?.('Your account is not enrolled in a class for this course yet. Please contact Admin or your teacher.');
      return;
    }

    if (activeSessionMaxTurnsReached) {
      triggerToast?.('This chat is full. Start a new chat to continue.');
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
    setChatInput(prompt);
  };

  const handleAnswerAction = async ({ prompt, type, message: answerMessage }) => {
    if (type === 'retry') {
      const retryText = String(answerMessage?.question || prompt || '').trim();
      if (!retryText) {
        triggerToast?.('There is no question to retry.');
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
        triggerToast?.('Support request sent to mentor.');
        loadEscalations?.();
        switchTab?.('student-escalation');
      } catch (error) {
        triggerToast?.(getUserFacingError(error, 'Unable to create support request.'));
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
    message.loading({ content: 'Downloading file...', key: 'dl' });
    try {
      const blob = await materialsApi.downloadMaterialPdf(courseId, materialId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title || 'material'}.pdf`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      message.success({ content: 'Download completed.', key: 'dl' });
    } catch {
      message.error({ content: 'Unable to download the file (it might be a website material).', key: 'dl' });
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

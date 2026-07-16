import { useState, useMemo } from 'react';
import ChatMessageList from './ChatMessageList';
import { buildMaterialSourceMap } from '../../utils/sourceLabels';
import { classIdMatches } from '../../utils/academicIds';
import ChatComposer from '../../features/student/chat/components/ChatComposer';
import ChatWorkspaceHeader from '../../features/student/chat/components/ChatWorkspaceHeader';
import PinnedMessagesBar from '../../features/student/chat/components/PinnedMessagesBar';
import { useAnswerFeedback } from '../../features/student/chat/useAnswerFeedback';
import { usePinnedChatMessages } from '../../features/student/chat/usePinnedChatMessages';
import './ChatWorkspace.css';

const CHAT_TURN_LIMIT = 10;

function ChatWorkspace({
  activeSessionTitle,
  courseId,
  onCourseChange,
  classId,
  courseOptions = [],
  classOptions = [],
  isStudentEnrollmentsLoading = false,
  hasLoadedStudentEnrollments = true,
  hasStudentEnrollments = true,
  messages,
  chatInput,
  setChatInput,
  onSendQuery,
  onStopQuery,
  onPromptStarter,
  onAnswerAction,
  isAiLoading = false,
  messagesEndRef,
  style,
  handleStudentReviewAnswer,
  userId,
  studentName,
  currentUser,
  activeSessionId,
  activeSessionQuestionCount = 0,
  activeSessionMaxTurnsReached = false,
  turnLimitNotice,
  onTurnLimitBack,
  onDismissTurnLimitNotice,
  isDarkMode = false,
  triggerToast,
  courseMaterials = [],
  onAnalyzeStudyTip,
  onStudySuggestion,
  onCreateQuizFromSuggestion,
  onDownloadSource,
  onOpenMentorReview,
}) {
  const [pendingCourseId, setPendingCourseId] = useState('');

  const materialSourceMap = useMemo(() => buildMaterialSourceMap(courseMaterials), [courseMaterials]);
  const safeMessages = useMemo(() => (
    Array.isArray(messages) ? [...messages] : []
  ), [messages]);
  const {
    highlightedMessageKey,
    pinnedMessageIdSet,
    pinnedMessages,
    pinningMessageId,
    jumpToPinnedMessage,
    togglePinnedMessage,
  } = usePinnedChatMessages({
    userId,
    sessionId: activeSessionId,
    messages: safeMessages,
    triggerToast,
  });
  const feedbackController = useAnswerFeedback({
    activeSessionId,
    classId,
    courseId,
    onSubmitReview: handleStudentReviewAnswer,
    triggerToast,
    userId,
  });

  const safeCourseOptions = useMemo(() => {
    const options = (Array.isArray(courseOptions) ? courseOptions : [])
      .filter((item) => item?.value);
    return options;
  }, [courseOptions]);
  const safeClassOptions = useMemo(() => {
    const options = (Array.isArray(classOptions) ? classOptions : [])
      .filter((item) => item?.value);
    return options;
  }, [classOptions]);
  const selectedCourseValue = safeCourseOptions.some((item) => item.value === courseId) ? courseId : undefined;
  const selectedClassOption = safeClassOptions.find((item) => (
    item.value === classId
    || classIdMatches(item.value, classId)
    || (Array.isArray(item.aliases) && item.aliases.some((alias) => classIdMatches(alias, classId)))
  ));
  const shouldShowCourseSwitchBanner = Boolean(pendingCourseId && pendingCourseId !== courseId);
  const pendingCourseOption = safeCourseOptions.find((item) => item.value === pendingCourseId);
  const selectedClassValue = selectedClassOption?.value;
  const hasCourseSelection = Boolean(selectedCourseValue);
  const hasClassSelection = Boolean(selectedClassValue);
  const canChatWithCurrentContext = Boolean(
    !isStudentEnrollmentsLoading
    && hasLoadedStudentEnrollments
    && hasStudentEnrollments
    && hasCourseSelection
    && hasClassSelection
  );
  const chatContextMessage = isStudentEnrollmentsLoading
    ? 'Đang tải danh sách lớp đã ghi danh...'
    : !hasLoadedStudentEnrollments
      ? 'Đang kiểm tra thông tin ghi danh...'
      : !hasStudentEnrollments
        ? 'Tài khoản chưa được ghi danh vào lớp. Vui lòng liên hệ Admin hoặc giáo viên trước khi sử dụng AI Tutor.'
        : !hasCourseSelection
          ? 'Hãy chọn một môn học đã ghi danh trước khi hỏi AI Tutor.'
          : !hasClassSelection
            ? 'Lớp được xác định tự động từ thông tin ghi danh. Hãy chuyển sang môn có lớp đang hoạt động.'
            : '';
  const questionCount = Math.max(0, Math.min(CHAT_TURN_LIMIT, Number(activeSessionQuestionCount) || 0));
  const isNearTurnLimit = questionCount >= 8 && questionCount < CHAT_TURN_LIMIT && !activeSessionMaxTurnsReached;
  const handleCourseSelect = (nextCourseId) => {
    if (!nextCourseId || nextCourseId === courseId) return;
    if (!courseId) {
      onCourseChange?.(nextCourseId, { confirmed: true });
      return;
    }
    setPendingCourseId(nextCourseId);
  };
  const confirmCourseSwitch = () => {
    if (!pendingCourseId) return;
    const nextCourseId = pendingCourseId;
    setPendingCourseId('');
    onCourseChange?.(nextCourseId, { confirmed: true });
  };

  return (
    <div className="chat-workspace-dark" style={style}>
      <ChatWorkspaceHeader
        activeSessionMaxTurnsReached={activeSessionMaxTurnsReached}
        activeSessionTitle={activeSessionTitle}
        canChat={canChatWithCurrentContext}
        chatContextMessage={chatContextMessage}
        courseOptions={safeCourseOptions}
        hasLoadedStudentEnrollments={hasLoadedStudentEnrollments}
        hasStudentEnrollments={hasStudentEnrollments}
        isDarkMode={isDarkMode}
        isNearTurnLimit={isNearTurnLimit}
        isStudentEnrollmentsLoading={isStudentEnrollmentsLoading}
        onCancelCourseSwitch={() => setPendingCourseId('')}
        onConfirmCourseSwitch={confirmCourseSwitch}
        onCourseSelect={handleCourseSelect}
        onDismissTurnLimitNotice={onDismissTurnLimitNotice}
        onTurnLimitBack={onTurnLimitBack}
        pendingCourseId={shouldShowCourseSwitchBanner ? pendingCourseId : ''}
        pendingCourseLabel={pendingCourseOption?.label}
        questionCount={questionCount}
        selectedClassLabel={selectedClassOption?.label || selectedClassValue}
        selectedCourseValue={selectedCourseValue}
        turnLimitNotice={turnLimitNotice}
      />

      <PinnedMessagesBar
        messages={pinnedMessages}
        onJump={jumpToPinnedMessage}
        onToggle={togglePinnedMessage}
      />

      <ChatMessageList
        activeSessionId={activeSessionId}
        canChat={canChatWithCurrentContext}
        classId={classId}
        courseId={courseId}
        currentUser={currentUser}
        feedback={feedbackController}
        highlightedMessageKey={highlightedMessageKey}
        isAiLoading={isAiLoading}
        materialSourceMap={materialSourceMap}
        messages={safeMessages}
        messagesEndRef={messagesEndRef}
        onAnalyzeStudyTip={onAnalyzeStudyTip}
        onAnswerAction={onAnswerAction}
        onCreateQuizFromSuggestion={onCreateQuizFromSuggestion}
        onDownloadSource={onDownloadSource}
        onOpenMentorReview={onOpenMentorReview}
        onPromptStarter={onPromptStarter}
        onStudySuggestion={onStudySuggestion}
        pinnedMessageIdSet={pinnedMessageIdSet}
        pinningMessageId={pinningMessageId}
        studentName={studentName}
        togglePinnedMessage={togglePinnedMessage}
        triggerToast={triggerToast}
        userId={userId}
      />

      <ChatComposer
        activeSessionMaxTurnsReached={activeSessionMaxTurnsReached}
        canChat={canChatWithCurrentContext}
        chatContextMessage={chatContextMessage}
        chatInput={chatInput}
        isAiLoading={isAiLoading}
        onSend={onSendQuery}
        onStop={onStopQuery}
        setChatInput={setChatInput}
        triggerToast={triggerToast}
      />
    </div>
  );
}

export default ChatWorkspace;

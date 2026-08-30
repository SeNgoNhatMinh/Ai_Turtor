import { useState, useMemo } from 'react';
import ChatMessageList from './ChatMessageList';
import { buildMaterialSourceMap } from '../../../../utils/sourceLabels';
import { classIdMatches } from '../../../../utils/academicIds';
import ChatComposer from './ChatComposer';
import ChatWorkspaceHeader from './ChatWorkspaceHeader';
import PinnedMessagesBar from './PinnedMessagesBar';
import { useAnswerFeedback } from '../useAnswerFeedback';
import { usePinnedChatMessages } from '../usePinnedChatMessages';
import { buildLessonChatPrompt, lessonSuggestionsForMessage } from '../../learning/studySuggestionPrompt';
import { uiCopy } from '../../../../constants/uiCopy';
import '../ChatWorkspace.css';

const CHAT_TURN_LIMIT = 10;

function ChatWorkspace({
  activeSessionTitle,
  isHistoryOpen = false,
  onToggleHistory,
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
  onResendMessage,
  onStopQuery,
  onPromptStarter,
  onCheckUnderstanding,
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
  courseDailyQuota = { used: 0, remaining: 10, limit: 10 },
  courseDailyQuotaExhausted = false,
  turnLimitNotice,
  onTurnLimitBack,
  onDismissTurnLimitNotice,
  isDarkMode = false,
  triggerToast,
  courseMaterials = [],
  mentorRequests = [],
  onStudySuggestion,
  onCreateQuizFromSuggestion,
  onDownloadSource,
  onOpenMentorReview,
  onMentorRequestCreated,
  tutorSession,
  tutorSessionSummary,
  isTutorSessionLoading = false,
  onStartNextTutorSession,
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
  const questionCount = Math.max(0, Math.min(
    Number(courseDailyQuota?.limit) || CHAT_TURN_LIMIT,
    Number(courseDailyQuota?.used ?? activeSessionQuestionCount) || 0,
  ));
  const dailyQuotaExhausted = Boolean(courseDailyQuotaExhausted || courseDailyQuota?.remaining <= 0);
  const isNearTurnLimit = questionCount >= 8 && !dailyQuotaExhausted;
  const composerTopics = useMemo(() => {
    const sessionTopics = (Array.isArray(tutorSession?.suggestedTopics) ? tutorSession.suggestedTopics : [])
      .map((topic) => String(topic || '').trim())
      .filter(Boolean);
    const parsedLessons = lessonSuggestionsForMessage(safeMessages[safeMessages.length - 1])
      .map((item) => String(item?.title || item?.suggestionText || item || '').trim())
      .filter(Boolean);
    const looksLikeLessons = (topics) => topics.some((topic) => /(?:bắt đầu\s+)?(?:bài|bai)\s+\d+/i.test(topic));
    if (looksLikeLessons(sessionTopics)) return sessionTopics;
    if (parsedLessons.length > 0) return parsedLessons;
    return sessionTopics;
  }, [safeMessages, tutorSession?.suggestedTopics]);
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
        activeSessionMaxTurnsReached={dailyQuotaExhausted}
        activeSessionTitle={activeSessionTitle}
        isHistoryOpen={isHistoryOpen}
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
        onToggleHistory={onToggleHistory}
        onDismissTurnLimitNotice={onDismissTurnLimitNotice}
        onTurnLimitBack={onTurnLimitBack}
        pendingCourseId={shouldShowCourseSwitchBanner ? pendingCourseId : ''}
        pendingCourseLabel={pendingCourseOption?.label}
        questionCount={questionCount}
        selectedClassLabel={selectedClassOption?.label || selectedClassValue}
        selectedCourseValue={selectedCourseValue}
        turnLimitNotice={turnLimitNotice}
      />

      <section className="tutor-session-strip" aria-label="Lộ trình buổi học">
        <div className="tutor-session-strip__heading">
          <div>
            <strong>{dailyQuotaExhausted ? uiCopy.student.chat.sessionCompleteTitle : 'AI Tutor đang đồng hành'}</strong>
            <span>
              {dailyQuotaExhausted
                ? uiCopy.student.chat.sessionComplete
                : tutorSession?.status === 'COMPLETED'
                  ? 'Đã tổng kết và gửi buổi học cho giảng viên'
                  : `Giai đoạn: ${tutorSession?.phase || 'OPEN'} · Mức hỗ trợ: ${tutorSession?.supportLevel || 'STANDARD'}`}
            </span>
          </div>
          {tutorSession?.status === 'COMPLETED' && !dailyQuotaExhausted && (
            <button type="button" onClick={onStartNextTutorSession} disabled={isTutorSessionLoading}>
              Bắt đầu buổi tiếp theo
            </button>
          )}
        </div>
        {dailyQuotaExhausted && (
          <p className="tutor-session-strip__summary">{uiCopy.student.chat.sessionCompleteHint}</p>
        )}
        {tutorSessionSummary?.summaryText && (
          <p className="tutor-session-strip__summary">{tutorSessionSummary.summaryText}</p>
        )}
      </section>

      <PinnedMessagesBar
        messages={pinnedMessages}
        onJump={jumpToPinnedMessage}
        onToggle={togglePinnedMessage}
      />

      <ChatMessageList
        activeSessionId={activeSessionId}
        activeSessionMaxTurnsReached={dailyQuotaExhausted}
        canChat={canChatWithCurrentContext}
        classId={classId}
        courseId={courseId}
        currentUser={currentUser}
        feedback={feedbackController}
        highlightedMessageKey={highlightedMessageKey}
        isAiLoading={isAiLoading}
        materialSourceMap={materialSourceMap}
        mentorRequests={mentorRequests}
        messages={safeMessages}
        messagesEndRef={messagesEndRef}
        onAnswerAction={onAnswerAction}
        onCreateQuizFromSuggestion={onCreateQuizFromSuggestion}
        onDownloadSource={onDownloadSource}
        onOpenMentorReview={onOpenMentorReview}
        onMentorRequestCreated={onMentorRequestCreated}
        onPromptStarter={onPromptStarter}
        onCheckUnderstanding={onCheckUnderstanding}
        onResendMessage={onResendMessage}
        onStudySuggestion={onStudySuggestion}
        pinnedMessageIdSet={pinnedMessageIdSet}
        pinningMessageId={pinningMessageId}
        studentName={studentName}
        togglePinnedMessage={togglePinnedMessage}
        triggerToast={triggerToast}
        userId={userId}
      />

      {tutorSession?.status !== 'COMPLETED' && !dailyQuotaExhausted && composerTopics.length > 0 && (
        <div className="tutor-session-strip__topics tutor-session-strip__topics--composer" role="list">
          {composerTopics.map((topic) => (
            <button
              type="button"
              key={topic}
              onClick={() => onPromptStarter?.(buildLessonChatPrompt(topic))}
            >
              {topic}
            </button>
          ))}
        </div>
      )}

      <ChatComposer
        activeSessionMaxTurnsReached={dailyQuotaExhausted}
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

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../../app/queryKeys';
import ChatMessageList from './ChatMessageList';
import { buildMaterialSourceMap } from '../../../../utils/sourceLabels';
import { classIdMatches } from '../../../../utils/academicIds';
import ChatComposer from './ChatComposer';
import ChatWorkspaceHeader from './ChatWorkspaceHeader';
import PinnedMessagesBar from './PinnedMessagesBar';
import { useAnswerFeedback } from '../useAnswerFeedback';
import { usePinnedChatMessages } from '../usePinnedChatMessages';
import { buildLessonChatPrompt, lessonSuggestionsForMessage } from '../../learning/studySuggestionPrompt';
import { getUserFacingError } from '../../../../services/apiClient';
import { ttsApi } from '../../../../services/ttsApi';
import '../ChatWorkspace.css';

const CHAT_TURN_LIMIT = 10;
const normalizeTtsVoices = (response) => (
  Array.isArray(response) ? response.filter((voice) => voice?.id && voice?.name) : []
);

function ChatWorkspace({
  activeSessionTitle,
  isHistoryOpen = false,
  courseId,
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
  onLockUnderstandingAnswer,
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
  courseDailyQuota = { used: 0, remaining: 10, limit: 10 },
  courseDailyQuotaExhausted = false,
  turnLimitNotice,
  onTurnLimitBack,
  onDismissTurnLimitNotice,
  triggerToast,
  courseMaterials = [],
  mentorRequests = [],
  onStudySuggestion,
  onCreateQuizFromSuggestion,
  onDownloadSource,
  onOpenMentorReview,
  onMentorRequestCreated,
  tutorSession,
}) {
  const [ttsVoiceId, setTtsVoiceId] = useState('');

  const voiceStorageKey = useMemo(() => (
    `ai-tutor:student-tts-voice:${String(userId || currentUser?.id || 'current')}:${courseId || 'none'}:${classId || 'none'}`
  ), [classId, courseId, currentUser?.id, userId]);

  const ttsVoicesQuery = useQuery({
    queryKey: queryKeys.ttsVoices(courseId, classId),
    queryFn: ({ signal }) => ttsApi.listVoices(courseId, classId, { signal }),
    enabled: Boolean(courseId && classId),
    select: normalizeTtsVoices,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
  });
  const ttsVoices = useMemo(() => ttsVoicesQuery.data || [], [ttsVoicesQuery.data]);
  const ttsVoicesError = ttsVoicesQuery.error
    ? getUserFacingError(ttsVoicesQuery.error, 'Không thể tải danh sách giọng.')
    : '';

  const storedTtsVoiceId = useMemo(() => {
    try {
      return window.localStorage.getItem(voiceStorageKey) || '';
    } catch {
      return '';
    }
  }, [voiceStorageKey]);
  const selectedTtsVoiceId = ttsVoices.some((voice) => voice.id === ttsVoiceId)
    ? ttsVoiceId
    : ttsVoices.some((voice) => voice.id === storedTtsVoiceId)
      ? storedTtsVoiceId
      : ttsVoices[0]?.id || '';

  const changeTtsVoice = (nextVoiceId) => {
    if (!ttsVoices.some((voice) => voice.id === nextVoiceId)) return;
    setTtsVoiceId(nextVoiceId);
    try {
      window.localStorage.setItem(voiceStorageKey, nextVoiceId);
    } catch {
      // The selection remains active for the current tab.
    }
  };

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
  const suggestedTopics = tutorSession?.suggestedTopics;
  const composerTopics = useMemo(() => {
    const sessionTopics = (Array.isArray(suggestedTopics) ? suggestedTopics : [])
      .map((topic) => String(topic || '').trim())
      .filter(Boolean);
    const parsedLessons = lessonSuggestionsForMessage(safeMessages[safeMessages.length - 1])
      .map((item) => String(item?.title || item?.suggestionText || item || '').trim())
      .filter(Boolean);
    const looksLikeLessons = (topics) => topics.some((topic) => /(?:bắt đầu\s+)?(?:bài|bai)\s+\d+/i.test(topic));
    if (looksLikeLessons(sessionTopics)) return sessionTopics;
    if (parsedLessons.length > 0) return parsedLessons;
    return sessionTopics;
  }, [safeMessages, suggestedTopics]);
  return (
    <div className="chat-workspace-dark" style={style}>
      <ChatWorkspaceHeader
        activeSessionTitle={activeSessionTitle}
        isHistoryOpen={isHistoryOpen}
        canChat={canChatWithCurrentContext}
        chatContextMessage={chatContextMessage}
        hasLoadedStudentEnrollments={hasLoadedStudentEnrollments}
        hasStudentEnrollments={hasStudentEnrollments}
        isNearTurnLimit={isNearTurnLimit}
        isStudentEnrollmentsLoading={isStudentEnrollmentsLoading}
        onDismissTurnLimitNotice={onDismissTurnLimitNotice}
        onTurnLimitBack={onTurnLimitBack}
        questionCount={questionCount}
        turnLimitNotice={turnLimitNotice}
      />

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
        onLockUnderstandingAnswer={onLockUnderstandingAnswer}
        onResendMessage={onResendMessage}
        onStudySuggestion={onStudySuggestion}
        pinnedMessageIdSet={pinnedMessageIdSet}
        pinningMessageId={pinningMessageId}
        studentName={studentName}
        togglePinnedMessage={togglePinnedMessage}
        triggerToast={triggerToast}
        ttsEnabled={ttsVoices.length > 0 && !ttsVoicesError}
        ttsVoices={ttsVoices}
        ttsVoicesLoading={ttsVoicesQuery.isPending}
        onTtsVoiceChange={changeTtsVoice}
        voiceId={selectedTtsVoiceId}
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

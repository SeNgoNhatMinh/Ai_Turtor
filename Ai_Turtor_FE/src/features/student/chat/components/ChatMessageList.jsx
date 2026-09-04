import { lazy, Suspense, useEffect, useState } from 'react';
import {
  findMentorRequestForMessage,
  getCanonicalMessageSources,
  getMessageKey,
  getPinTargetId,
} from '../chatMessageUtils';
import AnswerActionBar from './AnswerActionBar';
import AnswerEvidence from './AnswerEvidence';

const withoutLegacyEvidenceAppendix = (answer, evidenceMessage) => {
  const value = String(answer || '');
  const hasEvidenceMetadata = (Array.isArray(evidenceMessage?.sourceEvidence) && evidenceMessage.sourceEvidence.length > 0)
    || (Array.isArray(evidenceMessage?.sources) && evidenceMessage.sources.length > 0);
  if (!hasEvidenceMetadata) return value;
  return value.replace(/\n{1,3}#{1,3}\s*Bằng chứng trích từ tài liệu[\s\S]*$/iu, '').trim();
};
import AnswerFeedbackControls from './AnswerFeedbackControls';
import AnswerImproveSuggestions from './AnswerImproveSuggestions';
import LessonDeepDiveCta from './LessonDeepDiveCta';
import ChatLoadingSteps from './ChatLoadingSteps';
import InlineMentorSupport from './InlineMentorSupport';
import PromptStarters from './PromptStarters';
import StudentMessageBubble from './StudentMessageBubble';
import { uiCopy } from '../../../../constants/uiCopy';
import { lessonSuggestionsForMessage, resolveChatStudyTip } from '../../learning/studySuggestionPrompt';
import { isAiServiceErrorText, shouldOfferLessonContinuations } from '../../../../utils/errorMessages';
import TutorMascot from '../../../../components/common/TutorMascot';
import { useMarkdownReveal } from '../useMarkdownReveal';
import TtsMessageAction from './TtsMessageAction';
import { useMessageAudio } from '../useMessageAudio';

const AiAnswer = lazy(() => import('../../../../components/AiAnswer'));

function scrollChatToEnd(messagesEndRef) {
  const marker = messagesEndRef?.current;
  const container = marker?.closest('.chat-workspace-messages-container');
  if (!container) return;
  if (typeof container.scrollTo === 'function') {
    container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
    return;
  }
  container.scrollTop = container.scrollHeight;
}

function StudentLiveAnswer({
  activeSessionId,
  activeSessionMaxTurnsReached,
  classId,
  courseId,
  currentUser,
  escalationId,
  evidenceMessage,
  feedback,
  feedbackIndex,
  handleAnswerAction,
  isPinned,
  isPinning,
  isWelcomeTurn,
  materialSourceMap,
  message,
  messageAudio,
  messageKey,
  messagesEndRef,
  offerLessonContinuations,
  onCreateQuizFromSuggestion,
  onDownloadSource,
  onLockUnderstandingAnswer,
  onMentorRequestCreated,
  onOpenMentorReview,
  onStudySuggestion,
  openSupportCards,
  pathSuggestions,
  setLocalEscalationIds,
  setOpenSupportCards,
  showGeneralActions,
  showMentorSupport,
  showTtsAction,
  studentName,
  togglePinnedMessage,
  triggerToast,
  tutorTurnFailed,
  userId,
  voiceId,
}) {
  const fullMarkdown = withoutLegacyEvidenceAppendix(message.answer, evidenceMessage);
  const reveal = Boolean(message.revealAnswer) && !tutorTurnFailed && !message.canceled;
  const { text: revealedMarkdown, done } = useMarkdownReveal(fullMarkdown, reveal);

  useEffect(() => {
    if (!reveal || done) return;
    scrollChatToEnd(messagesEndRef);
  }, [done, messagesEndRef, reveal, revealedMarkdown]);

  return (
    <>
      <Suspense fallback={<div className="chat-answer-loading">Đang định dạng câu trả lời...</div>}>
        <AiAnswer
          markdown={revealedMarkdown}
          understandingCheck={done ? message.understandingCheck : null}
          understandingSelectedKey={done ? message.understandingSelectedKey : ''}
          attemptId={message.assistantMessageId || message.messageId || message.id}
          streaming={reveal && !done}
          sourceMap={materialSourceMap}
          onStudyTipStudy={done ? (text) => onStudySuggestion?.({
            text: resolveChatStudyTip(message.question, text),
            sourceMode: message.mode,
          }) : undefined}
          onLockAnswer={done ? (key) => onLockUnderstandingAnswer?.(message, key) : undefined}
          onDownloadSource={onDownloadSource}
          hideSourceSection
        />
      </Suspense>

      {done && (
        <AnswerEvidence
          message={evidenceMessage}
          sourceMap={materialSourceMap}
          onDownloadSource={onDownloadSource}
        />
      )}
      {done && !message.canceled && offerLessonContinuations && !isWelcomeTurn && (
        <AnswerImproveSuggestions
          suggestions={pathSuggestions}
          onStudy={onStudySuggestion}
          onCreateQuiz={onCreateQuizFromSuggestion}
          sourceMode={message.mode}
        />
      )}
      {done && !message.canceled && offerLessonContinuations && !isWelcomeTurn
        && pathSuggestions.length === 0 && (
        <LessonDeepDiveCta
          question={message.question}
          answer={message.answer}
          onStudy={onStudySuggestion}
        />
      )}
      {done && (showTtsAction || showGeneralActions) && (
        <div className="chat-ai-action-row">
          {showTtsAction && (
            <TtsMessageAction
              messageKey={messageKey}
              speech={messageAudio.state}
              onToggle={() => messageAudio.toggle({
                messageKey,
                messageId: message.assistantMessageId || message.messageId || message.id || messageKey,
                courseId,
                classId,
                text: fullMarkdown,
                providerVoiceId: voiceId,
              })}
              onStop={() => messageAudio.stop(messageKey)}
              onSeek={(value) => messageAudio.seek(messageKey, value)}
            />
          )}
          {showGeneralActions && (
            <AnswerActionBar
              message={{
                ...message,
                aiServiceError: tutorTurnFailed,
                retryable: Boolean(message.retryable || tutorTurnFailed),
              }}
              mentorRequestInProgress={showMentorSupport}
              disableRetry={activeSessionMaxTurnsReached}
              onAction={handleAnswerAction}
            />
          )}
        </div>
      )}

      {done && !message.canceled && showMentorSupport && (
        <InlineMentorSupport
          message={{ ...message, questionEscalationId: escalationId }}
          userId={userId}
          studentName={studentName}
          studentEmail={currentUser?.email}
          currentUser={currentUser}
          courseId={courseId}
          classId={classId}
          conversationId={activeSessionId}
          isOpen={Boolean(openSupportCards[messageKey])}
          onOpen={() => setOpenSupportCards((current) => ({ ...current, [messageKey]: true }))}
          onClose={() => setOpenSupportCards((current) => ({ ...current, [messageKey]: false }))}
          onEscalationCreated={(nextId) => {
            setLocalEscalationIds((current) => ({ ...current, [messageKey]: nextId }));
            onMentorRequestCreated?.();
          }}
          onOpenReviewTab={onOpenMentorReview}
          triggerToast={triggerToast}
        />
      )}

      {done && !message.canceled && !isWelcomeTurn && !tutorTurnFailed && (
        <AnswerFeedbackControls
          index={feedbackIndex}
          message={message}
          isPinned={isPinned}
          isFeedbackSubmitting={feedback.isFeedbackSubmitting}
          feedbackOpenIndex={feedback.feedbackOpenIndex}
          feedbackPanelMode={feedback.feedbackPanelMode}
          feedbackAction={feedback.feedbackAction}
          feedbackText={feedback.feedbackText}
          setFeedbackText={feedback.setFeedbackText}
          onTogglePin={() => togglePinnedMessage(message)}
          isPinning={isPinning}
          onHelpful={() => feedback.submitQuickReview(message, 'helpful')}
          onToggleRatingPanel={feedback.toggleRatingPanel}
          onSelectStar={feedback.selectStarRating}
          onOpenFeedback={feedback.openFeedbackForm}
          onCloseFeedback={feedback.closeFeedbackForm}
          onSubmitFeedback={() => feedback.submitFeedback(message)}
        />
      )}
    </>
  );
}

function ChatMessageList({
  activeSessionId,
  activeSessionMaxTurnsReached,
  canChat,
  classId,
  courseId,
  currentUser,
  feedback,
  highlightedMessageKey,
  isAiLoading,
  materialSourceMap,
  mentorRequests = [],
  messages,
  messagesEndRef,
  onAnswerAction,
  onCreateQuizFromSuggestion,
  onDownloadSource,
  onOpenMentorReview,
  onMentorRequestCreated,
  onPromptStarter,
  onLockUnderstandingAnswer,
  onResendMessage,
  onStudySuggestion,
  pinnedMessageIdSet,
  pinningMessageId,
  studentName,
  togglePinnedMessage,
  triggerToast,
  ttsEnabled = true,
  userId,
  voiceId = '',
}) {
  const [openSupportCards, setOpenSupportCards] = useState({});
  const [localEscalationIds, setLocalEscalationIds] = useState({});
  const messageAudio = useMessageAudio(
    `${activeSessionId || ''}:${courseId || ''}:${classId || ''}:${voiceId}`,
  );

  const openInlineSupport = (messageKey) => {
    setOpenSupportCards((current) => ({ ...current, [messageKey]: true }));
  };

  const handleAnswerAction = (action) => {
    if (action?.type === 'mentor') {
      const index = messages.indexOf(action.message);
      openInlineSupport(getMessageKey(action.message, index >= 0 ? index : 0));
      return;
    }
    onAnswerAction?.(action);
  };

  return (
    <div className={`chat-workspace-messages-container ${messages.length === 0 ? 'chat-workspace-messages-container--empty' : ''}`}>
      <div className={`chat-workspace-messages-inner ${messages.length === 0 ? 'chat-workspace-messages-inner--empty' : ''}`}>
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <TutorMascot size="lg" className="chat-empty-mascot" />
            <div className="chat-empty-title">Hôm nay bạn muốn học gì?</div>
            <div className="chat-keyword-tip" role="note">
              <strong>{uiCopy.student.chat.keywordTipTitle}</strong>
              <p>{uiCopy.student.chat.keywordTip}</p>
            </div>
            <PromptStarters disabled={!canChat || isAiLoading} onSelect={onPromptStarter} />
          </div>
        ) : (
          messages.map((message, index) => {
            const messageKey = getMessageKey(message, index);
            const evidenceMessage = {
              ...message,
              sources: getCanonicalMessageSources(message, materialSourceMap),
            };
            const pinTargetId = getPinTargetId(message);
            const isPinned = Boolean(pinTargetId && pinnedMessageIdSet.has(pinTargetId));
            const isPinning = Boolean(pinTargetId && pinningMessageId === pinTargetId);
            const existingMentorRequest = findMentorRequestForMessage({
              requests: mentorRequests,
              message,
              conversationId: activeSessionId,
              courseId,
              classId,
            });
            const escalationId = message.questionEscalationId
              || localEscalationIds[messageKey]
              || existingMentorRequest?.id
              || existingMentorRequest?.questionEscalationId;
            const isWelcomeTurn = Boolean(message.proactive) || !String(message.question || '').trim();
            const showMentorSupport = !isWelcomeTurn && Boolean(escalationId || openSupportCards[messageKey]);
            const pathSuggestions = lessonSuggestionsForMessage(message);
            const offerLessonContinuations = shouldOfferLessonContinuations(message);
            const tutorTurnFailed = Boolean(message.aiServiceError || isAiServiceErrorText(message.answer));
            const showTtsAction = ttsEnabled && !tutorTurnFailed && !message.canceled
              && Boolean(String(message.answer || '').trim());
            const showGeneralActions = !message.canceled && !message.sessionComplete && !isWelcomeTurn;

            return (
                <div
                key={messageKey}
                data-chat-message-key={messageKey}
                className={`chat-message-turn ${highlightedMessageKey === messageKey ? 'chat-message-turn--highlighted' : ''}`}
              >
                {String(message.question || '').trim() ? (
                  <div className="chat-gpt-message-row user">
                    <StudentMessageBubble
                      canResend={canChat && !isAiLoading && !activeSessionMaxTurnsReached}
                      isPinned={isPinned}
                      onResend={onResendMessage}
                      question={message.question}
                      triggerToast={triggerToast}
                    />
                  </div>
                ) : null}

                {!message.pending && (
                  <div className="chat-gpt-message-row ai">
                    <div className="chat-gpt-bubble-ai">
                      <div className="chat-gpt-ai-avatar">
                        <TutorMascot size="sm" />
                      </div>
                      <div className="chat-gpt-ai-content">
                        {tutorTurnFailed && (
                          <div className="chat-ai-service-error" role="status">
                            <strong>Mình chưa soạn xong lượt này.</strong>
                            <span>
                              {activeSessionMaxTurnsReached
                                ? 'Câu hỏi này chưa được trả lời. Phía dưới là kết thúc phiên học hôm nay, không phải lỗi hệ thống.'
                                : 'Không phải hết phiên học. Bấm Thử lại giúp mình, hoặc gửi mentor xem xét.'}
                            </span>
                          </div>
                        )}

                        {!tutorTurnFailed && (
                          <StudentLiveAnswer
                            activeSessionId={activeSessionId}
                            activeSessionMaxTurnsReached={activeSessionMaxTurnsReached}
                            classId={classId}
                            courseId={courseId}
                            currentUser={currentUser}
                            escalationId={escalationId}
                            evidenceMessage={evidenceMessage}
                            feedback={feedback}
                            feedbackIndex={index}
                            handleAnswerAction={handleAnswerAction}
                            isPinned={isPinned}
                            isPinning={isPinning}
                            isWelcomeTurn={isWelcomeTurn}
                            materialSourceMap={materialSourceMap}
                            message={message}
                            messageAudio={messageAudio}
                            messageKey={messageKey}
                            messagesEndRef={messagesEndRef}
                            offerLessonContinuations={offerLessonContinuations}
                            onCreateQuizFromSuggestion={onCreateQuizFromSuggestion}
                            onDownloadSource={onDownloadSource}
                            onLockUnderstandingAnswer={onLockUnderstandingAnswer}
                            onMentorRequestCreated={onMentorRequestCreated}
                            onOpenMentorReview={onOpenMentorReview}
                            onStudySuggestion={onStudySuggestion}
                            openSupportCards={openSupportCards}
                            pathSuggestions={pathSuggestions}
                            setLocalEscalationIds={setLocalEscalationIds}
                            setOpenSupportCards={setOpenSupportCards}
                            showGeneralActions={showGeneralActions}
                            showMentorSupport={showMentorSupport}
                            showTtsAction={showTtsAction}
                            studentName={studentName}
                            togglePinnedMessage={togglePinnedMessage}
                            triggerToast={triggerToast}
                            tutorTurnFailed={tutorTurnFailed}
                            userId={userId}
                            voiceId={voiceId}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {isAiLoading && (
          <div className="chat-gpt-loading">
            <div className="chat-gpt-loading-avatar">
              <TutorMascot size="sm" />
            </div>
            <ChatLoadingSteps />
          </div>
        )}
        {activeSessionMaxTurnsReached && !isAiLoading && messages.length > 0 && (
          <div className="chat-session-complete-card" role="status">
            <strong>{uiCopy.student.chat.sessionCompleteTitle}</strong>
            <p>{uiCopy.student.chat.sessionComplete}</p>
            <span>{uiCopy.student.chat.sessionCompleteHint}</span>
          </div>
        )}
        <div ref={messagesEndRef} style={{ height: 1 }} />
      </div>
    </div>
  );
}

export default ChatMessageList;

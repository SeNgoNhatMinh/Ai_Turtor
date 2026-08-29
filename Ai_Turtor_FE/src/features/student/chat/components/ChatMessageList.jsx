import { lazy, Suspense, useState } from 'react';
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
import ChatLoadingSteps from './ChatLoadingSteps';
import InlineMentorSupport from './InlineMentorSupport';
import PromptStarters from './PromptStarters';
import StudentMessageBubble from './StudentMessageBubble';
import { uiCopy } from '../../../../constants/uiCopy';
import { lessonSuggestionsForMessage } from '../../learning/studySuggestionPrompt';

const AiAnswer = lazy(() => import('../../../../components/AiAnswer'));
function TutorMascot({ size, className = '' }) {
  return <img src="/favicon.jpg" alt="Linh vật AI Tutor" className={`chat-fpt-mascot ${className}`} style={{ width: size, height: size }} />;
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
  onResendMessage,
  onStudySuggestion,
  pinnedMessageIdSet,
  pinningMessageId,
  studentName,
  togglePinnedMessage,
  triggerToast,
  userId,
}) {
  const [openSupportCards, setOpenSupportCards] = useState({});
  const [localEscalationIds, setLocalEscalationIds] = useState({});

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
            <TutorMascot size={152} className="chat-empty-mascot" />
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
            const showMentorSupport = Boolean(escalationId || openSupportCards[messageKey]);

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
                      <div style={{ flexShrink: 0, marginTop: '-4px' }}>
                        <TutorMascot size={36} />
                      </div>
                      <div className="chat-gpt-ai-content">
                        {message.aiServiceError && (
                          <div className="chat-ai-service-error" role="alert">
                            <strong>AI Tutor tạm thời không phản hồi.</strong>
                            <span>Hãy thử lại sau hoặc gửi câu hỏi cho mentor xem xét.</span>
                          </div>
                        )}

                        <Suspense fallback={<div className="chat-answer-loading">Đang định dạng câu trả lời...</div>}>
                          <AiAnswer
                            markdown={withoutLegacyEvidenceAppendix(message.answer, evidenceMessage)}
                            sourceMap={materialSourceMap}
                            onStudyTipStudy={(text) => onStudySuggestion?.({
                              text,
                              sourceMode: message.mode,
                            })}
                            onDownloadSource={onDownloadSource}
                            hideSourceSection
                          />
                        </Suspense>

                        <AnswerEvidence
                          message={evidenceMessage}
                          sourceMap={materialSourceMap}
                          onDownloadSource={onDownloadSource}
                        />
                        {!message.canceled && !message.aiServiceError && (
                          <AnswerImproveSuggestions
                            suggestions={lessonSuggestionsForMessage(message)}
                            onStudy={onStudySuggestion}
                            onCreateQuiz={onCreateQuizFromSuggestion}
                            sourceMode={message.mode}
                          />
                        )}
                        {!message.canceled && (
                          <AnswerActionBar
                            message={message}
                            mentorRequestInProgress={showMentorSupport}
                            onAction={handleAnswerAction}
                          />
                        )}

                        {!message.canceled && showMentorSupport && (
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
                            onOpen={() => openInlineSupport(messageKey)}
                            onClose={() => setOpenSupportCards((current) => ({ ...current, [messageKey]: false }))}
                            onEscalationCreated={(nextId) => {
                              setLocalEscalationIds((current) => ({ ...current, [messageKey]: nextId }));
                              onMentorRequestCreated?.();
                            }}
                            onOpenReviewTab={onOpenMentorReview}
                            triggerToast={triggerToast}
                          />
                        )}

                        {!message.canceled && (
                          <AnswerFeedbackControls
                            index={index}
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
              <TutorMascot size={32} />
            </div>
            <ChatLoadingSteps />
          </div>
        )}
        <div ref={messagesEndRef} style={{ height: 1 }} />
      </div>
    </div>
  );
}

export default ChatMessageList;

import { lazy, Suspense, useState } from 'react';
import { PushpinOutlined } from '@ant-design/icons';
import { getMessageKey, getPinTargetId } from '../../features/student/chat/chatMessageUtils';
import AnswerActionBar from './AnswerActionBar';
import AnswerEvidence from './AnswerEvidence';
import AnswerFeedbackControls from './AnswerFeedbackControls';
import AnswerImproveSuggestions from './AnswerImproveSuggestions';
import ChatLoadingSteps from './ChatLoadingSteps';
import InlineMentorSupport from './InlineMentorSupport';
import PromptStarters from './PromptStarters';

const AiAnswer = lazy(() => import('../../components/AiAnswer'));
const RobotHeadMascot = lazy(() => import('../../components/RobotHeadMascot'));

function MascotFallback({ size = 36 }) {
  return (
    <div
      className="chat-mascot-fallback"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

function ChatMessageList({
  activeSessionId,
  canChat,
  classId,
  courseId,
  currentUser,
  feedback,
  highlightedMessageKey,
  isAiLoading,
  materialSourceMap,
  messages,
  messagesEndRef,
  onAnalyzeStudyTip,
  onAnswerAction,
  onCreateQuizFromSuggestion,
  onDownloadSource,
  onOpenMentorReview,
  onPromptStarter,
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
            <Suspense fallback={<MascotFallback size={152} />}>
              <RobotHeadMascot size={152} followMouse={false} className="chat-empty-mascot" />
            </Suspense>
            <div className="chat-empty-title">Hôm nay bạn muốn học gì?</div>
            <PromptStarters disabled={!canChat || isAiLoading} onSelect={onPromptStarter} />
          </div>
        ) : (
          messages.map((message, index) => {
            const messageKey = getMessageKey(message, index);
            const pinTargetId = getPinTargetId(message);
            const isPinned = Boolean(pinTargetId && pinnedMessageIdSet.has(pinTargetId));
            const isPinning = Boolean(pinTargetId && pinningMessageId === pinTargetId);
            const escalationId = message.questionEscalationId || localEscalationIds[messageKey];
            const showMentorSupport = Boolean(escalationId || openSupportCards[messageKey]);

            return (
              <div
                key={messageKey}
                data-chat-message-key={messageKey}
                className={`chat-message-turn ${highlightedMessageKey === messageKey ? 'chat-message-turn--highlighted' : ''}`}
              >
                <div className="chat-gpt-message-row user">
                  <div className={`chat-gpt-bubble-user ${isPinned ? 'chat-message-pinned' : ''}`}>
                    {isPinned && <PushpinOutlined className="chat-message-pin-badge" />}
                    {message.question}
                  </div>
                </div>

                {!message.pending && (
                  <div className="chat-gpt-message-row ai">
                    <div className="chat-gpt-bubble-ai">
                      <div style={{ flexShrink: 0, marginTop: '-4px' }}>
                        <Suspense fallback={<MascotFallback size={36} />}>
                          <RobotHeadMascot size={36} compact followMouse={false} />
                        </Suspense>
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
                            markdown={message.answer || ''}
                            sourceMap={materialSourceMap}
                            onStudyTipAnalyze={onAnalyzeStudyTip}
                            onDownloadSource={onDownloadSource}
                            hideSourceSection={Array.isArray(message.sources) && message.sources.length > 0}
                          />
                        </Suspense>

                        <AnswerEvidence
                          message={message}
                          sourceMap={materialSourceMap}
                          onDownloadSource={onDownloadSource}
                        />
                        {!message.canceled && !message.aiServiceError && (
                          <AnswerImproveSuggestions
                            suggestions={message.nextImproveSuggestions}
                            onStudy={onStudySuggestion}
                            onCreateQuiz={onCreateQuizFromSuggestion}
                          />
                        )}
                        {!message.canceled && (
                          <AnswerActionBar message={message} onAction={handleAnswerAction} />
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
                            }}
                            onOpenReviewTab={onOpenMentorReview}
                            triggerToast={triggerToast}
                          />
                        )}

                        {!message.canceled && (
                          <AnswerFeedbackControls
                            index={index}
                            isPinned={isPinned}
                            isFeedbackSubmitting={feedback.isFeedbackSubmitting}
                            feedbackOpenIndex={feedback.feedbackOpenIndex}
                            feedbackAction={feedback.feedbackAction}
                            feedbackText={feedback.feedbackText}
                            setFeedbackText={feedback.setFeedbackText}
                            onTogglePin={() => togglePinnedMessage(message)}
                            isPinning={isPinning}
                            onHelpful={() => feedback.submitQuickReview(message, 'helpful')}
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
              <Suspense fallback={<MascotFallback size={32} />}>
                <RobotHeadMascot size={32} compact followMouse={false} />
              </Suspense>
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

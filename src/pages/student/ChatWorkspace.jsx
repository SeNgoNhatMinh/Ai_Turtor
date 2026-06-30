import { useState, useEffect, useMemo, useRef } from 'react';
import { Select, Space, Typography, Input, Button } from 'antd';
import { SendOutlined, LikeOutlined, DislikeOutlined, CommentOutlined, StopOutlined, PushpinOutlined, CloseOutlined } from '@ant-design/icons';
import RobotHeadMascot from '../../components/RobotHeadMascot';
import AiAnswer from '../../components/AiAnswer';
import AnswerActionBar from './AnswerActionBar';
import AnswerEvidence from './AnswerEvidence';
import ChatLoadingSteps from './ChatLoadingSteps';
import PromptStarters from './PromptStarters';
import { normalizeReviewMode, validateChatInput, validateFeedbackText } from '../../utils/validators';
import { buildMaterialSourceMap } from '../../utils/sourceLabels';
import './ChatWorkspace.css';

const { Title, Text } = Typography;
const { Option } = Select;
const CHAT_TURN_LIMIT = 10;

const getReviewMode = (message) => {
  return normalizeReviewMode(message?.mode);
};

const hashText = (value) => {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const getMessageKey = (message, index) => {
  if (message?.id || message?.messageId || message?.requestId) {
    return String(message.id || message.messageId || message.requestId);
  }
  const question = String(message?.question || '').trim();
  const answer = String(message?.answer || '').trim();
  const stableContent = `${question.slice(0, 500)}|${answer.slice(0, 500)}`;
  if (stableContent.trim()) {
    return `content-${hashText(stableContent)}`;
  }
  return `message-${index}`;
};

const getPinnedStorageKey = (userId, sessionId) => {
  if (!userId || !sessionId) return '';
  return `ai-tutor:pinned-chat-messages:${userId}:${sessionId}`;
};

const getMessagePreview = (message) => {
  const text = message?.question || message?.answer || '';
  return text.length > 82 ? `${text.slice(0, 82)}...` : text;
};

function ChatWorkspace({
  activeSessionTitle,
  courseId,
  onCourseChange,
  classId,
  setClassId,
  courseOptions = [],
  classOptions = [],
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
}) {
  const [feedbackOpenIndex, setFeedbackOpenIndex] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(null); // 1 or 3
  const [feedbackText, setFeedbackText] = useState('');
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [pinnedMessageKeys, setPinnedMessageKeys] = useState([]);
  const [highlightedMessageKey, setHighlightedMessageKey] = useState('');

  const textareaRef = useRef(null);
  const materialSourceMap = useMemo(() => buildMaterialSourceMap(courseMaterials), [courseMaterials]);

  useEffect(() => {
    const storageKey = getPinnedStorageKey(userId, activeSessionId);
    if (!storageKey) {
      setPinnedMessageKeys([]);
      return;
    }
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
      setPinnedMessageKeys(Array.isArray(stored) ? stored : []);
    } catch {
      setPinnedMessageKeys([]);
    }
  }, [userId, activeSessionId]);

  useEffect(() => {
    const storageKey = getPinnedStorageKey(userId, activeSessionId);
    if (!storageKey) return;
    window.localStorage.setItem(storageKey, JSON.stringify(pinnedMessageKeys));
  }, [pinnedMessageKeys, userId, activeSessionId]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [chatInput]);

  const openFeedbackForm = (index, rating) => {
    setFeedbackOpenIndex(index);
    setFeedbackRating(rating);
    setFeedbackText('');
  };

  const closeFeedbackForm = () => {
    setFeedbackOpenIndex(null);
    setFeedbackRating(null);
    setFeedbackText('');
  };

  const togglePinnedMessage = (messageKey) => {
    setPinnedMessageKeys((current) => (
      current.includes(messageKey)
        ? current.filter((key) => key !== messageKey)
        : current.length >= 3
          ? (triggerToast?.('You can pin up to 3 messages.'), current)
          : [...current, messageKey]
    ));
  };

  const jumpToPinnedMessage = (messageKey) => {
    const target = document.querySelector(`[data-chat-message-key="${CSS.escape(messageKey)}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageKey(messageKey);
    window.setTimeout(() => {
      setHighlightedMessageKey((current) => (current === messageKey ? '' : current));
    }, 1600);
  };

  const buildFeedbackPayload = (message, rating, feedback) => {
    if (!userId) return { ok: false, message: 'Please sign in before submitting feedback.' };
    if (!courseId || !classId) return { ok: false, message: 'Please choose a course and class first.' };
    if (!message?.answer) return { ok: false, message: 'There is no AI answer to review.' };

    return {
      ok: true,
      value: {
        studentId: userId,
        courseId,
        classId,
        conversationId: activeSessionId || '',
        mode: getReviewMode(message),
        reviewType: rating === 1 ? 'ANSWER_DISPUTE' : 'QUALITY_FEEDBACK',
        question: message.question || '',
        answer: message.answer || '',
        rating,
        accurate: rating === 5,
        helpful: rating === 5,
        correctnessLevel: rating === 5 ? 'HIGH' : 'INCORRECT',
        feedback,
        suggestedCorrection: rating === 1 ? feedback : undefined,
        reviewedBy: userId,
        reviewerRole: 'STUDENT'
      }
    };
  };

  const submitQuickReview = async (message, rating, defaultFeedback) => {
    if (!handleStudentReviewAnswer) return;
    const payload = buildFeedbackPayload(message, rating, defaultFeedback);
    if (!payload.ok) {
      triggerToast?.(payload.message);
      return;
    }
    setIsFeedbackSubmitting(true);
    try {
      await handleStudentReviewAnswer(payload.value);
    } finally {
      setIsFeedbackSubmitting(false);
    }
  };

  const submitFeedback = async (message) => {
    if (!handleStudentReviewAnswer) return;
    const textValidation = validateFeedbackText(feedbackText);
    if (!textValidation.ok) {
      triggerToast?.(textValidation.message);
      return;
    }
    const payload = buildFeedbackPayload(message, feedbackRating, textValidation.value);
    if (!payload.ok) {
      triggerToast?.(payload.message);
      return;
    }
    setIsFeedbackSubmitting(true);
    try {
      await handleStudentReviewAnswer(payload.value);
      closeFeedbackForm();
    } finally {
      setIsFeedbackSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (activeSessionMaxTurnsReached) {
        triggerToast?.('This chat is full. Start a new chat to continue.');
        return;
      }
      const validation = validateChatInput(chatInput);
      if (!validation.ok) {
        triggerToast?.(validation.message);
        return;
      }
      onSendQuery();
    }
  };

  const safeMessages = Array.isArray(messages) ? messages : [];
  const safeCourseOptions = useMemo(() => {
    const options = (Array.isArray(courseOptions) ? courseOptions : [])
      .filter((item) => item?.value);
    return options.length ? options : [
      { value: 'PRJ301', label: 'PRJ301 - Java Web' },
      { value: 'DBI202', label: 'DBI202 - Database' },
    ];
  }, [courseOptions]);
  const safeClassOptions = useMemo(() => {
    const options = (Array.isArray(classOptions) ? classOptions : [])
      .filter((item) => item?.value);
    return options.length ? options : [
      { value: 'SE1840', label: 'Class SE1840' },
      { value: 'SE1841', label: 'Class SE1841' },
    ];
  }, [classOptions]);
  const pinnedMessages = safeMessages
    .map((message, index) => ({ message, index, key: getMessageKey(message, index) }))
    .filter((item) => pinnedMessageKeys.includes(item.key))
    .slice(0, 3);
  const selectedCourseValue = safeCourseOptions.some((item) => item.value === courseId) ? courseId : undefined;
  const selectedClassValue = safeClassOptions.some((item) => item.value === classId) ? classId : undefined;
  const questionCount = Math.max(0, Math.min(CHAT_TURN_LIMIT, Number(activeSessionQuestionCount) || 0));
  const isNearTurnLimit = questionCount >= 8 && questionCount < CHAT_TURN_LIMIT && !activeSessionMaxTurnsReached;
  const sendDisabled = !validateChatInput(chatInput).ok || activeSessionMaxTurnsReached;

  return (
    <div className="chat-workspace-dark" style={style}>
      {/* Header */}
      <div className="chat-workspace-header">
        <div className="chat-header-main">
          <Title level={4} style={{ margin: 0, fontSize: '1.1rem' }}>{activeSessionTitle}</Title>
          <div className="chat-header-meta-row">
            <Text type="secondary" style={{ fontSize: '0.8rem' }}>AI Tutor Session</Text>
            <span className={`chat-turn-counter ${activeSessionMaxTurnsReached ? 'chat-turn-counter--full' : isNearTurnLimit ? 'chat-turn-counter--warning' : ''}`}>
              Questions {questionCount}/{CHAT_TURN_LIMIT}
            </span>
          </div>
          {isNearTurnLimit && (
            <div className="chat-turn-helper">
              This chat is almost full. AI Tutor will continue in a new chat after 10 questions.
            </div>
          )}
          {activeSessionMaxTurnsReached && (
            <div className="chat-turn-helper chat-turn-helper--full">
              This chat is full. Start a new chat to continue.
            </div>
          )}
        </div>
        <Space wrap>
          <Select
            value={selectedCourseValue}
            onChange={onCourseChange}
            style={{ width: 150 }}
            placeholder="Choose course"
            popupClassName={`chat-course-select-popup ${isDarkMode ? 'chat-course-select-popup--dark' : ''}`}
          >
            {safeCourseOptions.map((item) => (
              <Option key={item.value} value={item.value}>{item.label}</Option>
            ))}
          </Select>
          <Select
            value={selectedClassValue}
            onChange={setClassId}
            style={{ width: 168 }}
            placeholder="Choose class"
            optionLabelProp="label"
            popupClassName={`chat-course-select-popup ${isDarkMode ? 'chat-course-select-popup--dark' : ''}`}
          >
            {safeClassOptions.map((item) => (
              <Option key={item.value} value={item.value} label={`Class ${item.value}`}>
                {item.label}
              </Option>
            ))}
          </Select>
        </Space>
      </div>

      {turnLimitNotice && (
        <div className="chat-turn-limit-banner" role="status">
          <div>
            <strong>New conversation started</strong>
            <span>{turnLimitNotice.message || 'This chat reached 10 questions. AI Tutor started a new conversation.'}</span>
          </div>
          <div className="chat-turn-limit-banner-actions">
            {turnLimitNotice.previousSessionId && (
              <button type="button" onClick={onTurnLimitBack}>
                Back to previous chat
              </button>
            )}
            <button
              type="button"
              className="chat-turn-limit-banner-close"
              aria-label="Dismiss notice"
              onClick={onDismissTurnLimitNotice}
            >
              <CloseOutlined />
            </button>
          </div>
        </div>
      )}

      {pinnedMessages.length > 0 && (
        <div className="chat-pinned-topbar" aria-label="Pinned messages">
          <div className="chat-pinned-topbar-label">
            <PushpinOutlined />
            <span>Pinned</span>
            <em>{pinnedMessages.length}/3</em>
          </div>
          <div className="chat-pinned-topbar-list">
            {pinnedMessages.map(({ message, key }) => (
              <button
                key={key}
                type="button"
                className="chat-pinned-topbar-item"
                onClick={() => jumpToPinnedMessage(key)}
                title="Jump to pinned message"
              >
                <span>{getMessagePreview(message) || 'Pinned message'}</span>
                <CloseOutlined
                  className="chat-pinned-unpin"
                  title="Unpin message"
                  onClick={(event) => {
                    event.stopPropagation();
                    togglePinnedMessage(key);
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="chat-workspace-messages-container">
        <div className="chat-workspace-messages-inner">
          {safeMessages.length === 0 ? (
            <div className="chat-empty-state">
              <RobotHeadMascot size={180} />
              <div className="chat-empty-title">How can I help you today?</div>
              <PromptStarters onSelect={onPromptStarter} />
            </div>
          ) : (
            safeMessages.map((message, index) => {
              const messageKey = getMessageKey(message, index);
              const isPinned = pinnedMessageKeys.includes(messageKey);
              return (
                <div
                  key={messageKey}
                  data-chat-message-key={messageKey}
                  className={`chat-message-turn ${highlightedMessageKey === messageKey ? 'chat-message-turn--highlighted' : ''}`}
                >
                  {/* User Message */}
                  <div className="chat-gpt-message-row user">
                    <div className={`chat-gpt-bubble-user ${isPinned ? 'chat-message-pinned' : ''}`}>
                      {isPinned && <PushpinOutlined className="chat-message-pin-badge" />}
                      {message.question}
                    </div>
                  </div>

                  {/* AI Message */}
                  {!message.pending && (
                    <div className="chat-gpt-message-row ai">
                      <div className="chat-gpt-bubble-ai">
                        <div style={{ flexShrink: 0, marginTop: '-4px' }}>
                          <RobotHeadMascot size={36} compact={true} followMouse={true} />
                        </div>
                        <div className="chat-gpt-ai-content">
                          {message.aiServiceError && (
                            <div className="chat-ai-service-error" role="alert">
                              <strong>AI service is temporarily unavailable.</strong>
                              <span>Retry this question in a moment, or ask a mentor for help.</span>
                            </div>
                          )}

                          <AiAnswer
                            markdown={message.answer || ''}
                            sourceMap={materialSourceMap}
                            onStudyTipAnalyze={onAnalyzeStudyTip}
                          />

                          <AnswerEvidence message={message} sourceMap={materialSourceMap} />
                          {!message.canceled && <AnswerActionBar message={message} onAction={onAnswerAction} />}

                          {/* Feedback Actions */}
                          {!message.canceled && <div className="chat-gpt-feedback-row">
                            <Button
                              type="text"
                              size="small"
                              className={`chat-pin-action ${isPinned ? 'chat-pin-action--active' : ''}`}
                              icon={<PushpinOutlined />}
                              onClick={() => togglePinnedMessage(messageKey)}
                              aria-label={isPinned ? 'Unpin message' : 'Pin message'}
                              title={isPinned ? 'Unpin message' : 'Pin message'}
                            />
                            <Button
                              type="text"
                              size="small"
                              icon={<LikeOutlined />}
                              disabled={isFeedbackSubmitting}
                              onClick={() => submitQuickReview(message, 5, 'Helpful')}
                            >
                              Helpful
                            </Button>
                            <Button
                              type="text"
                              size="small"
                              icon={<DislikeOutlined />}
                              disabled={isFeedbackSubmitting}
                              onClick={() => openFeedbackForm(index, 1)}
                            >
                              Not correct
                            </Button>
                            <Button
                              type="text"
                              size="small"
                              icon={<CommentOutlined />}
                              disabled={isFeedbackSubmitting}
                              onClick={() => openFeedbackForm(index, 3)}
                            >
                              Need more detail
                            </Button>
                          </div>}

                          {/* Feedback Form */}
                          {feedbackOpenIndex === index && (
                            <div className="feedback-form-box" style={{
                              marginTop: 12,
                              background: '#f9f9f9',
                              border: '1px solid #ececec',
                              padding: 12,
                              borderRadius: 12,
                            }}>
                              <div className="feedback-title" style={{ marginBottom: 8, fontSize: 12, color: '#0d0d0d' }}>
                                {feedbackRating === 1 ? 'What is not correct?' : 'What detail do you need?'}
                              </div>
                              <Input.TextArea
                                className="feedback-textarea"
                                rows={2}
                                placeholder={feedbackRating === 1 ? 'Point out the incorrect part...' : 'Tell us what needs more detail...'}
                                value={feedbackText}
                                maxLength={2000}
                                onChange={(e) => setFeedbackText(e.target.value)}
                                style={{ background: '#fff', border: '1px solid #ececec', color: '#0d0d0d', borderRadius: 8, marginBottom: 8 }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <Button size="small" type="text" style={{ color: '#888' }} onClick={closeFeedbackForm}>Cancel</Button>
                                <Button
                                  className="btn-submit"
                                  size="small"
                                  type="primary"
                                  style={{ background: '#0d0d0d', color: '#ffffff', border: 'none' }}
                                  onClick={() => submitFeedback(message)}
                                  loading={isFeedbackSubmitting}
                                  disabled={!feedbackText.trim() || isFeedbackSubmitting}
                                >
                                  Submit
                                </Button>
                              </div>
                            </div>
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
              <div style={{ flexShrink: 0, marginLeft: '-42px' }}>
                <RobotHeadMascot size={32} compact={true} followMouse={true} />
              </div>
              <ChatLoadingSteps />
            </div>
          )}
          <div ref={messagesEndRef} style={{ height: 1 }} />
        </div>
      </div>

      {/* Input Area */}
      <div className="chat-workspace-input-area">
        <div className="chat-workspace-input-inner">
          <div className="chat-gpt-input-wrapper">
            <textarea
              ref={textareaRef}
              placeholder={activeSessionMaxTurnsReached ? 'This chat is full. Start a new chat to continue.' : isAiLoading ? 'AI Tutor is responding...' : 'Message AI Tutor...'}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={8000}
              disabled={isAiLoading}
              rows={1}
            />
            {isAiLoading ? (
              <button className="chat-gpt-send-btn" onClick={onStopQuery} title="Stop Generating">
                <StopOutlined />
              </button>
            ) : (
              <button
                className="chat-gpt-send-btn"
                onClick={onSendQuery}
                disabled={sendDisabled}
                title={activeSessionMaxTurnsReached ? 'This chat is full. Start a new chat to continue.' : 'Send message'}
              >
                <SendOutlined />
              </button>
            )}
          </div>
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: '#888' }}>
            AI Tutor can make mistakes. Consider verifying important information.
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatWorkspace;

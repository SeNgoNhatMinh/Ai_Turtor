import { useState, useEffect, useRef } from 'react';
import { Select, Space, Typography, Input, Button } from 'antd';
import { SendOutlined, LikeOutlined, DislikeOutlined, CommentOutlined, StopOutlined, PushpinOutlined } from '@ant-design/icons';
import RobotHeadMascot from '../../components/RobotHeadMascot';
import AiAnswer from '../../components/AiAnswer';
import AnswerActionBar from './AnswerActionBar';
import AnswerEvidence from './AnswerEvidence';
import ChatLoadingSteps from './ChatLoadingSteps';
import PromptStarters from './PromptStarters';
import { normalizeReviewMode, validateChatInput, validateFeedbackText } from '../../utils/validators';
import './ChatWorkspace.css';

const { Title, Text } = Typography;
const { Option } = Select;

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
  return text.length > 110 ? `${text.slice(0, 110)}...` : text;
};

function ChatWorkspace({
  activeSessionTitle,
  courseId,
  setCourseId,
  classId,
  setClassId,
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
  isDarkMode = false,
  triggerToast,
}) {
  const [feedbackOpenIndex, setFeedbackOpenIndex] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(null); // 1 or 3
  const [feedbackText, setFeedbackText] = useState('');
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [pinnedMessageKeys, setPinnedMessageKeys] = useState([]);

  const textareaRef = useRef(null);

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
        : [...current, messageKey]
    ));
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
      const validation = validateChatInput(chatInput);
      if (!validation.ok) {
        triggerToast?.(validation.message);
        return;
      }
      onSendQuery();
    }
  };

  const safeMessages = Array.isArray(messages) ? messages : [];
  const pinnedMessages = safeMessages
    .map((message, index) => ({ message, index, key: getMessageKey(message, index) }))
    .filter((item) => pinnedMessageKeys.includes(item.key));

  return (
    <div className="chat-workspace-dark" style={style}>
      {/* Header */}
      <div className="chat-workspace-header">
        <div>
          <Title level={4} style={{ margin: 0, fontSize: '1.1rem' }}>{activeSessionTitle}</Title>
          <Text type="secondary" style={{ fontSize: '0.8rem' }}>AI Tutor Session</Text>
        </div>
        <Space wrap>
          <Select
            value={courseId}
            onChange={setCourseId}
            style={{ width: 150 }}
            popupClassName={`chat-course-select-popup ${isDarkMode ? 'chat-course-select-popup--dark' : ''}`}
          >
            <Option value="PRJ301">PRJ301 - Java Web</Option>
            <Option value="DBI202">DBI202 - Database</Option>
          </Select>
          <Select
            value={classId}
            onChange={setClassId}
            style={{ width: 120 }}
            popupClassName={`chat-course-select-popup ${isDarkMode ? 'chat-course-select-popup--dark' : ''}`}
          >
            <Option value="SE1840">Class SE1840</Option>
            <Option value="SE1841">Class SE1841</Option>
          </Select>
        </Space>
      </div>

      {/* Messages Area */}
      <div className="chat-workspace-messages-container">
        <div className="chat-workspace-messages-inner">
          {pinnedMessages.length > 0 && (
            <div className="chat-pinned-panel">
              <div className="chat-pinned-header">
                <PushpinOutlined />
                <span>Pinned messages</span>
              </div>
              <div className="chat-pinned-list">
                {pinnedMessages.map(({ message, key }) => (
                  <button
                    key={key}
                    type="button"
                    className="chat-pinned-item"
                    onClick={() => togglePinnedMessage(key)}
                    title="Click to unpin"
                  >
                    <span>{getMessagePreview(message)}</span>
                    <PushpinOutlined />
                  </button>
                ))}
              </div>
            </div>
          )}

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
                <div key={messageKey} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
                          <AiAnswer markdown={message.answer || ''} />

                          <AnswerEvidence message={message} />
                          {!message.canceled && <AnswerActionBar message={message} onAction={onAnswerAction} />}

                          {/* Feedback Actions */}
                          {!message.canceled && <div className="chat-gpt-feedback-row">
                            <Button
                              type="text"
                              size="small"
                              icon={<PushpinOutlined />}
                              onClick={() => togglePinnedMessage(messageKey)}
                            >
                              {isPinned ? 'Unpin' : 'Pin'}
                            </Button>
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
              placeholder={isAiLoading ? 'AI Tutor is responding...' : 'Message AI Tutor...'}
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
                disabled={!validateChatInput(chatInput).ok}
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

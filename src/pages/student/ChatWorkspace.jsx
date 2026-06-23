import React, { useState, useEffect, useRef } from 'react';
import { Select, Space, Typography, Input, Button } from 'antd';
import { SendOutlined, LikeOutlined, DislikeOutlined, CommentOutlined, StopOutlined } from '@ant-design/icons';
import RobotHeadMascot from '../../components/RobotHeadMascot';
import AiAnswer from '../../components/AiAnswer';
import AnswerActionBar from './AnswerActionBar';
import AnswerEvidence from './AnswerEvidence';
import ChatLoadingSteps from './ChatLoadingSteps';
import PromptStarters from './PromptStarters';
import './ChatWorkspace.css';

const { Title, Text } = Typography;
const { Option } = Select;

const getReviewMode = (message) => {
  if (message?.mode === 'ESCALATE') return 'ESCALATE';
  if (message?.mode === 'CODE' || message?.mode === 'CODE_MENTOR') return 'CODE';
  return 'RAG';
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
}) {
  const [feedbackOpenIndex, setFeedbackOpenIndex] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(null); // 1 or 3
  const [feedbackText, setFeedbackText] = useState('');

  const textareaRef = useRef(null);

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

  const submitQuickReview = (message, rating, defaultFeedback) => {
    if (!handleStudentReviewAnswer) return;
    const payload = {
      studentId: userId || 'student-a1',
      courseId: courseId || 'PRJ301',
      classId: classId || 'SE1840',
      conversationId: activeSessionId || '',
      mode: getReviewMode(message),
      reviewType: 'QUALITY_FEEDBACK',
      question: message.question,
      answer: message.answer,
      rating: rating,
      accurate: rating === 5,
      helpful: rating === 5,
      correctnessLevel: rating === 5 ? 'HIGH' : 'INCORRECT',
      feedback: defaultFeedback,
      reviewedBy: userId || 'student-a1',
      reviewerRole: 'STUDENT'
    };
    handleStudentReviewAnswer(payload);
  };

  const submitFeedback = (message) => {
    if (!handleStudentReviewAnswer) return;
    const payload = {
      studentId: userId || 'student-a1',
      courseId: courseId || 'PRJ301',
      classId: classId || 'SE1840',
      conversationId: activeSessionId || '',
      mode: getReviewMode(message),
      reviewType: feedbackRating === 1 ? 'ANSWER_DISPUTE' : 'QUALITY_FEEDBACK',
      question: message.question,
      answer: message.answer,
      rating: feedbackRating,
      accurate: false,
      helpful: false,
      correctnessLevel: 'INCORRECT',
      feedback: feedbackText,
      suggestedCorrection: feedbackRating === 1 ? feedbackText : undefined,
      reviewedBy: userId || 'student-a1',
      reviewerRole: 'STUDENT'
    };
    handleStudentReviewAnswer(payload);
    closeFeedbackForm();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendQuery();
    }
  };

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
          {(Array.isArray(messages) ? messages : []).length === 0 ? (
            <div className="chat-empty-state">
              <RobotHeadMascot size={180} />
              <div className="chat-empty-title">How can I help you today?</div>
              <PromptStarters onSelect={onPromptStarter} />
            </div>
          ) : (
            (Array.isArray(messages) ? messages : []).map((message, index) => {
              return (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* User Message */}
                  <div className="chat-gpt-message-row user">
                    <div className="chat-gpt-bubble-user">
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
                              icon={<LikeOutlined />}
                              onClick={() => submitQuickReview(message, 5, 'Helpful')}
                            >
                              Helpful
                            </Button>
                            <Button
                              type="text"
                              size="small"
                              icon={<DislikeOutlined />}
                              onClick={() => openFeedbackForm(index, 1)}
                            >
                              Not correct
                            </Button>
                            <Button
                              type="text"
                              size="small"
                              icon={<CommentOutlined />}
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
                                  disabled={!feedbackText.trim()}
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
                disabled={!chatInput.trim()}
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

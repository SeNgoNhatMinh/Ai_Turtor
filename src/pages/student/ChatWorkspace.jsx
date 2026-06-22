import React, { useState, useEffect, useRef } from 'react';
import { Select, Space, Typography, Progress, Tag, Input, Button, Spin } from 'antd';
import { SendOutlined, InfoCircleOutlined, RobotOutlined, FileTextOutlined, LikeOutlined, DislikeOutlined, CommentOutlined, StopOutlined, LoadingOutlined } from '@ant-design/icons';
import RobotHeadMascot from '../../components/RobotHeadMascot';
import AiAnswer from '../../components/AiAnswer';
import './ChatWorkspace.css';

const { Title, Text } = Typography;
const { Option } = Select;

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
  isAiLoading = false,
  messagesEndRef,
  style,
  handleStudentReviewAnswer,
  userId,
  activeSessionId,
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
      mode: message.sources && message.sources.length ? 'RAG' : 'CODE_MENTOR',
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
      mode: message.sources && message.sources.length ? 'RAG' : 'CODE_MENTOR',
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
          <Select value={courseId} onChange={setCourseId} style={{ width: 150 }} dropdownStyle={{ backgroundColor: '#fff', color: '#000' }}>
            <Option value="PRJ301" style={{ color: '#000' }}>PRJ301 - Java Web</Option>
            <Option value="DBI202" style={{ color: '#000' }}>DBI202 - Database</Option>
          </Select>
          <Select value={classId} onChange={setClassId} style={{ width: 120 }} dropdownStyle={{ backgroundColor: '#fff', color: '#000' }}>
            <Option value="SE1840" style={{ color: '#000' }}>Class SE1840</Option>
            <Option value="SE1841" style={{ color: '#000' }}>Class SE1841</Option>
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
            </div>
          ) : (
            (Array.isArray(messages) ? messages : []).map((message, index) => {
              const isHigh = message.confidence != null && message.confidence >= 0.8;
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

                          {/* Metadata (Confidence & Sources) */}
                          {(message.confidence != null || (message.sources && message.sources.length > 0)) && (
                            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                              {message.confidence != null && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Text style={{ fontSize: 12, color: '#888' }}>Confidence: </Text>
                                  <Progress percent={Math.round(message.confidence * 100)} size="small" status={isHigh ? 'success' : 'exception'} style={{ width: 100, margin: 0 }} trailColor="#444" strokeColor={isHigh ? "#10b981" : undefined} />
                                </div>
                              )}
                              {message.sources && message.sources.length > 0 && (
                                <div style={{ display: 'flex', gap: 8 }}>
                                  {message.sources.map((source, sourceIndex) => (
                                    <Tag icon={<FileTextOutlined />} key={sourceIndex} color="orange" style={{ background: 'rgba(243, 112, 33, 0.1)', borderColor: 'transparent', color: '#F37021' }}>{source}</Tag>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {message.questionEscalationId && (
                            <div className="warning-note">
                              <Text style={{ color: '#fbbf24' }}><InfoCircleOutlined /> AI confidence is low and support was recorded (ID: {message.questionEscalationId}).</Text>
                            </div>
                          )}

                          {/* Feedback Actions */}
                          <div className="chat-gpt-feedback-row">
                            <Button
                              type="text"
                              size="small"
                              icon={<LikeOutlined />}
                              onClick={() => submitQuickReview(message, 5, 'Học sinh bấm Thích')}
                            />
                            <Button
                              type="text"
                              size="small"
                              icon={<DislikeOutlined />}
                              onClick={() => openFeedbackForm(index, 1)}
                            />
                            <Button
                              type="text"
                              size="small"
                              icon={<CommentOutlined />}
                              onClick={() => openFeedbackForm(index, 3)}
                            >
                              Feedback
                            </Button>
                          </div>

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
                                {feedbackRating === 1 ? '⚠️ Báo cáo lỗi sai:' : '💬 Góp ý kiến:'}
                              </div>
                              <Input.TextArea
                                className="feedback-textarea"
                                rows={2}
                                placeholder={feedbackRating === 1 ? 'Chỉ ra lỗi sai...' : 'Ý kiến của bạn...'}
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                                style={{ background: '#fff', border: '1px solid #ececec', color: '#0d0d0d', borderRadius: 8, marginBottom: 8 }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <Button size="small" type="text" style={{ color: '#888' }} onClick={closeFeedbackForm}>Hủy</Button>
                                <Button
                                  className="btn-submit"
                                  size="small"
                                  type="primary"
                                  style={{ background: '#0d0d0d', color: '#ffffff', border: 'none' }}
                                  onClick={() => submitFeedback(message)}
                                  disabled={!feedbackText.trim()}
                                >
                                  Gửi
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
              <Spin indicator={<LoadingOutlined style={{ fontSize: 16, color: '#0d0d0d' }} spin />} />
              <span>Thinking...</span>
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
              placeholder={isAiLoading ? 'Thinking...' : 'Message AI Tutor...'}
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

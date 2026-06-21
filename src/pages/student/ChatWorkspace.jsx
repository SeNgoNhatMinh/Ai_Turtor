import React, { useState } from 'react';
import { Avatar, Button, Card, Empty, Input, List, Progress, Select, Space, Spin, Tag, Typography } from 'antd';
import { SendOutlined, InfoCircleOutlined, UserOutlined, RobotOutlined, FileTextOutlined, LikeOutlined, DislikeOutlined, CommentOutlined, StopOutlined, LoadingOutlined } from '@ant-design/icons';
import { uiCopy } from '../../constants/uiCopy';

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

  return (
    <Card className="chat-workspace-card" style={style} bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0 }}>
      <div className="workspace-toolbar">
        <div>
          <Title level={4} style={{ margin: 0 }}>{activeSessionTitle}</Title>
          <Text type="secondary">Course: {courseId} | Class: {classId}</Text>
        </div>
        <Space wrap>
          <Select value={courseId} onChange={setCourseId} style={{ width: 150 }}>
            <Option value="PRJ301">PRJ301 - Java Web</Option>
            <Option value="DBI202">DBI202 - Database</Option>
          </Select>
          <Select value={classId} onChange={setClassId} style={{ width: 120 }}>
            <Option value="SE1840">Class SE1840</Option>
            <Option value="SE1841">Class SE1841</Option>
          </Select>
        </Space>
      </div>

      <div className="chat-message-list">
        {(Array.isArray(messages) ? messages : []).length === 0 ? (
          <Empty description={uiCopy.student.chat.empty} style={{ marginTop: 100 }} />
        ) : (
          <List
            dataSource={Array.isArray(messages) ? messages : []}
            renderItem={(message, index) => {
              const isHigh = message.confidence != null && message.confidence >= 0.8;
              return (
                <div key={index} style={{ marginBottom: 24 }}>
                  {/* User bubble */}
                  <div className="chat-bubble-row user">
                    <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#F37021' }} />
                    <div className="chat-bubble user">{message.question}</div>
                  </div>

                  {/* AI bubble — only shown when answer is ready (not pending) */}
                  {!message.pending && (
                    <div className="chat-bubble-row ai">
                      <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#14B8A6', color: '#fff' }} />
                      <div className="chat-bubble ai">
                        <div style={{ whiteSpace: 'pre-wrap' }}>{message.answer}</div>
                        {message.confidence != null && (
                          <div style={{ marginTop: 8 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>Confidence: </Text>
                            <Progress percent={Math.round(message.confidence * 100)} size="small" status={isHigh ? 'success' : 'exception'} style={{ width: 100 }} />
                          </div>
                        )}
                        {message.sources && message.sources.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            {message.sources.map((source, sourceIndex) => <Tag icon={<FileTextOutlined />} key={sourceIndex} color="orange">{source}</Tag>)}
                          </div>
                        )}
                        {message.questionEscalationId && (
                          <div className="warning-note">
                            <Text type="warning"><InfoCircleOutlined /> AI confidence is low and support was recorded (ID: {message.questionEscalationId}).</Text>
                          </div>
                        )}

                        {/* Hàng nút đánh giá phản hồi */}
                        <div style={{ marginTop: 12, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>Đánh giá câu trả lời này:</Text>
                          <Space size="small">
                            <Button
                              type="text"
                              size="small"
                              icon={<LikeOutlined style={{ color: '#10B981' }} />}
                              onClick={() => submitQuickReview(message, 5, 'Học sinh bấm Thích')}
                              style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              Hữu ích
                            </Button>
                            <Button
                              type="text"
                              size="small"
                              icon={<DislikeOutlined style={{ color: '#EF4444' }} />}
                              onClick={() => openFeedbackForm(index, 1)}
                              style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              Không hữu ích
                            </Button>
                            <Button
                              type="text"
                              size="small"
                              icon={<CommentOutlined style={{ color: '#F37021' }} />}
                              onClick={() => openFeedbackForm(index, 3)}
                              style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              Góp ý
                            </Button>
                          </Space>
                        </div>

                        {/* Vùng nhập phản hồi trực tiếp */}
                        {feedbackOpenIndex === index && (
                          <div style={{
                            marginTop: 12,
                            background: 'rgba(243, 112, 33, 0.03)',
                            border: '1px solid rgba(243, 112, 33, 0.15)',
                            padding: 10,
                            borderRadius: 8,
                            transition: 'all 0.3s ease'
                          }}>
                            <div style={{ marginBottom: 6, fontWeight: 500, fontSize: 11, color: '#F37021' }}>
                              {feedbackRating === 1 ? '⚠️ Báo cáo câu trả lời sai / không chuẩn xác:' : '💬 Góp ý kiến cải thiện:'}
                            </div>
                            <Input.TextArea
                              rows={2}
                              placeholder={feedbackRating === 1 ? 'Vui lòng chỉ ra lỗi sai và đề xuất câu trả lời đúng...' : 'Nhập ý kiến đóng góp của bạn...'}
                              value={feedbackText}
                              onChange={(e) => setFeedbackText(e.target.value)}
                              style={{ borderRadius: 6, fontSize: 12, marginBottom: 8 }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                              <Button size="small" onClick={closeFeedbackForm}>Hủy</Button>
                              <Button
                                size="small"
                                type="primary"
                                style={{ background: 'linear-gradient(135deg, #F37021 0%, #FF8F42 100%)', border: 'none' }}
                                onClick={() => submitFeedback(message)}
                                disabled={!feedbackText.trim()}
                              >
                                Gửi góp ý
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            }}
          />

        )}
        <div ref={messagesEndRef} />
        {isAiLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', margin: '8px 0' }}>
            <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#14B8A6', color: '#fff', flexShrink: 0 }} />
            <div style={{
              background: 'linear-gradient(135deg, rgba(20,184,166,0.08) 0%, rgba(243,112,33,0.06) 100%)',
              border: '1px solid rgba(20,184,166,0.2)',
              borderRadius: '2px 16px 16px 16px',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#374151',
              fontSize: 13,
              fontStyle: 'italic'
            }}>
              <Spin indicator={<LoadingOutlined style={{ fontSize: 14, color: '#14B8A6' }} spin />} />
              AI Tutor đang soạn câu trả lời...
            </div>
          </div>
        )}
      </div>

      <div className="chat-input-row">
        <Input.Search
          placeholder={isAiLoading ? 'AI Tutor đang soạn câu trả lời...' : uiCopy.student.chat.inputPlaceholder}
          enterButton={
            isAiLoading ? (
              <Button
                danger
                icon={<StopOutlined />}
                onClick={(e) => { e.preventDefault(); onStopQuery?.(); }}
                style={{ minWidth: 100, fontWeight: 600 }}
              >
                Dừng lại
              </Button>
            ) : (
              <Button type="primary" icon={<SendOutlined />} disabled={!chatInput.trim()}>
                Gửi
              </Button>
            )
          }
          size="large"
          value={chatInput}
          onChange={(event) => setChatInput(event.target.value)}
          onSearch={isAiLoading ? undefined : onSendQuery}
          disabled={isAiLoading}
          style={{ opacity: isAiLoading ? 0.85 : 1 }}
        />
      </div>
    </Card>
  );
}

export default ChatWorkspace;

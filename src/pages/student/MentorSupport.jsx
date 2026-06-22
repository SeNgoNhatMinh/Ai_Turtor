import React from 'react';
import { Alert, Avatar, Button, Card, Empty, Input, List, Space, Spin, Tag, Typography } from 'antd';
import { RobotOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import StatusTag from '../../components/common/StatusTag';
import { uiCopy } from '../../constants/uiCopy';

const { Paragraph, Text, Title } = Typography;

function MentorSupport({
  escalations,
  selectedEscalation,
  escChatMessages,
  escChatInput,
  setEscChatInput,
  escMessagesEndRef,
  userId = 'student-a1',
  isEscalationsLoading,
  escalationsError,
  chatUnreadCount = 0,
  chatRoomDetail,
  loadEscalations,
  onSelectEscalation,
  onSendEscalationMsg,
  onOpenMentorSelect,
  onCloseSupportChat,
}) {
  return (
    <div className="portal-section">
      <PageHeader title={uiCopy.student.support.title} description={uiCopy.student.support.subtitle} />
      <div className="support-layout">
        <Card
          title={uiCopy.student.support.listTitle}
          extra={
            <Space>
              {chatUnreadCount > 0 && <Tag color="orange">{chatUnreadCount} unread</Tag>}
              <Button size="small" onClick={loadEscalations}>Refresh</Button>
            </Space>
          }
          className="support-list-card"
          bodyStyle={{ flex: 1, overflowY: 'auto', padding: 0 }}
        >
          {escalationsError ? (
            <Alert type="error" showIcon message="Unable to load support requests" description={escalationsError} style={{ margin: 16 }} />
          ) : (
            <List
              loading={isEscalationsLoading}
              dataSource={escalations}
              renderItem={(escalation) => (
                <List.Item
                  className={`session-item ${selectedEscalation?.id === escalation.id ? 'ant-list-item-selected' : ''}`}
                  onClick={() => onSelectEscalation(escalation)}
                >
                  <List.Item.Meta
                    title={<Text strong style={{ color: selectedEscalation?.id === escalation.id ? '#F37021' : 'inherit' }} ellipsis>{escalation.questionPreview}</Text>}
                    description={
                      <Space direction="vertical" size={0}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{new Date(escalation.createdAt).toLocaleString('en-US')}</Text>
                        <StatusTag status={escalation.status} />
                      </Space>
                    }
                  />
                </List.Item>
              )}
              locale={{
                emptyText: (
                  <Empty description={uiCopy.student.support.emptyTitle} image={Empty.PRESENTED_IMAGE_SIMPLE}>
                    <Text type="secondary">{uiCopy.student.support.emptyDescription}</Text>
                  </Empty>
                ),
              }}
            />
          )}
        </Card>

        <Card className="support-detail-card" bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0 }}>
          {selectedEscalation ? (
            selectedEscalation.status === 'ASSIGNED' ? (
              <>
                <div className="workspace-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
                  <Title level={5} style={{ margin: 0 }}>Live Chat: Support Mentor</Title>
                  <Space>
                    {chatRoomDetail?.status && <Tag>{chatRoomDetail.status}</Tag>}
                    <Button size="small" danger onClick={onCloseSupportChat}>End chat</Button>
                  </Space>
                </div>
                <div className="chat-message-list">
                  <List
                    dataSource={escChatMessages}
                    renderItem={(message, index) => (
                      <div key={index} className={`support-message ${message.senderId === userId ? 'mine' : ''}`}>
                        <Avatar icon={<UserOutlined />} style={{ backgroundColor: message.senderId === userId ? '#F37021' : '#52c41a' }} />
                        <div className={`support-bubble ${message.senderId === userId ? 'mine' : ''}`}>
                          {message.content}
                        </div>
                      </div>
                    )}
                  />
                  <div ref={escMessagesEndRef} />
                </div>
                <div className="chat-input-row">
                  <Input.Search
                    placeholder="Enter a message for your mentor..."
                    enterButton={<Button type="primary" icon={<SendOutlined />}>Send</Button>}
                    size="large"
                    value={escChatInput}
                    onChange={(event) => setEscChatInput(event.target.value)}
                    onSearch={onSendEscalationMsg}
                  />
                </div>
              </>
            ) : selectedEscalation.status === 'OFFERED' ? (
              <div className="center-state">
                <RobotOutlined style={{ fontSize: 48, color: '#F37021', marginBottom: 16 }} />
                <Title level={4}>A mentor is ready to help</Title>
                <Paragraph style={{ textAlign: 'center' }}>
                  Your question has been reviewed. Choose a mentor to start a 1-on-1 chat.
                </Paragraph>
                <Button type="primary" size="large" onClick={() => onOpenMentorSelect(selectedEscalation)}>
                  View mentors
                </Button>
              </div>
            ) : (
              <div className="center-state">
                <Spin size="large" style={{ marginBottom: 16 }} />
                <Title level={4}>Waiting for a mentor</Title>
                <Paragraph style={{ textAlign: 'center' }}>
                  Your question has been sent to mentors. Please wait until someone accepts the support request.
                </Paragraph>
              </div>
            )
          ) : (
            <Empty description={uiCopy.student.support.detailEmpty} style={{ marginTop: 100 }}>
              <Text type="secondary">This panel shows mentor offers, live chat, and request status.</Text>
            </Empty>
          )}
        </Card>
      </div>
    </div>
  );
}

export default MentorSupport;

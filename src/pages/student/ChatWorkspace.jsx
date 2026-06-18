import React from 'react';
import { Avatar, Button, Card, Empty, Input, List, Progress, Select, Space, Tag, Typography } from 'antd';
import { SendOutlined, InfoCircleOutlined, UserOutlined, RobotOutlined, FileTextOutlined } from '@ant-design/icons';
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
  messagesEndRef,
}) {
  return (
    <Card className="chat-workspace-card" bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0 }}>
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
            renderItem={(message, index) => (
              <div key={index} style={{ marginBottom: 24 }}>
                <div className="chat-bubble-row user">
                  <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#F37021' }} />
                  <div className="chat-bubble user">{message.question}</div>
                </div>
                <div className="chat-bubble-row ai">
                  <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#F37021', color: '#fff' }} />
                  <div className="chat-bubble ai">
                    <Text style={{ whiteSpace: 'pre-wrap' }}>{message.answer}</Text>
                    {message.confidence != null && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Confidence: </Text>
                        <Progress percent={Math.round(message.confidence * 100)} size="small" status={message.confidence >= 0.8 ? 'success' : 'exception'} style={{ width: 100 }} />
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
                  </div>
                </div>
              </div>
            )}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-row">
        <Input.Search
          placeholder={uiCopy.student.chat.inputPlaceholder}
          enterButton={<Button type="primary" icon={<SendOutlined />}>Send</Button>}
          size="large"
          value={chatInput}
          onChange={(event) => setChatInput(event.target.value)}
          onSearch={onSendQuery}
        />
      </div>
    </Card>
  );
}

export default ChatWorkspace;

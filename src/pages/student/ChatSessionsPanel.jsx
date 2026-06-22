import React from 'react';
import { Button, Card, Input, List, Modal, Space, Typography } from 'antd';
import { MessageSquare, Edit2, Trash2 } from 'lucide-react';

const { Text } = Typography;

function ChatSessionsPanel({
  sessions,
  activeSessionId,
  onCreate,
  onSelect,
  onDelete,
  editingSessionId,
  editingSessionTitle,
  setEditingSessionId,
  setEditingSessionTitle,
  onSaveRename,
  style,
}) {
  return (
    <Card
      title="Conversations"
      extra={<Button type="primary" size="small" icon={<MessageSquare size={14} />} onClick={onCreate}>New</Button>}
      className="chat-sessions-card"
      style={style}
      bodyStyle={{ flex: 1, overflowY: 'auto', paddingLeft: 10 }}
    >
      <List
        dataSource={Array.isArray(sessions) ? sessions : []}
        renderItem={(session) => (
          <List.Item
            className={`session-item ${activeSessionId === session.id ? 'ant-list-item-selected' : ''}`}
            onClick={() => onSelect(session.id, session.title)}
          >
            <List.Item.Meta
              title={
                editingSessionId === session.id ? (
                  <Input
                    value={editingSessionTitle}
                    onChange={(event) => setEditingSessionTitle(event.target.value)}
                    onBlur={(event) => onSaveRename(event, session.id)}
                    onPressEnter={(event) => onSaveRename(event, session.id)}
                    onClick={(event) => event.stopPropagation()}
                    autoFocus
                    size="small"
                  />
                ) : (
                  <Text style={{ color: activeSessionId === session.id ? '#F37021' : 'inherit' }} ellipsis>{session.title}</Text>
                )
              }
              description={<Text type="secondary" style={{ fontSize: 12 }}>{new Date(session.createdAt).toLocaleDateString('en-US')}</Text>}
            />
            <Space onClick={(event) => event.stopPropagation()}>
              <Button
                type="text"
                size="small"
                icon={<Edit2 size={14} />}
                onClick={() => {
                  setEditingSessionId(session.id);
                  setEditingSessionTitle(session.title);
                }}
              />
              <Button
                type="text"
                size="small"
                danger
                icon={<Trash2 size={14} />}
                onClick={() => {
                  Modal.confirm({
                    title: 'Delete conversation?',
                    onConfirm: () => onDelete(session.id),
                  });
                }}
              />
            </Space>
          </List.Item>
        )}
      />
    </Card>
  );
}

export default ChatSessionsPanel;

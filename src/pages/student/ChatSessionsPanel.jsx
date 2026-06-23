import React, { useMemo, useState } from 'react';
import { Button, Card, Empty, Input, Modal, Space, Typography } from 'antd';
import { MessageSquare, Edit2, Trash2 } from 'lucide-react';
import ConversationSearch from './ConversationSearch';

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
  const [searchText, setSearchText] = useState('');
  const filteredSessions = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const list = Array.isArray(sessions) ? sessions : [];
    if (!query) return list;
    return list.filter((session) => String(session.title || '').toLowerCase().includes(query));
  }, [sessions, searchText]);

  return (
    <Card
      title="Conversations"
      extra={<Button type="primary" size="small" icon={<MessageSquare size={14} />} onClick={onCreate}>New</Button>}
      className="chat-sessions-card"
      style={style}
      styles={{ body: { flex: 1, overflowY: 'auto', paddingLeft: 10 } }}
    >
      <ConversationSearch value={searchText} onChange={setSearchText} />
      <div className="conversation-list">
        {filteredSessions.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={searchText ? 'No conversations match your search.' : 'Start a new AI Tutor session.'}
          />
        ) : filteredSessions.map((session) => (
          <div
            key={session.id}
            className={`session-item ${activeSessionId === session.id ? 'ant-list-item-selected' : ''}`}
            onClick={() => onSelect(session.id, session.title)}
          >
            <div className="session-item-main">
              <div className="session-item-title">
                {editingSessionId === session.id ? (
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
                )}
              </div>
              <div className="session-item-meta">
                <Text className="session-item-time">{new Date(session.createdAt).toLocaleDateString('en-US')}</Text>
                {(session.courseId || session.classId) && (
                  <span>{[session.courseId, session.classId].filter(Boolean).join(' / ')}</span>
                )}
              </div>
            </div>
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
          </div>
        ))}
      </div>
    </Card>
  );
}

export default ChatSessionsPanel;

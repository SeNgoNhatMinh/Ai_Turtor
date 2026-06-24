import { useMemo, useState } from 'react';
import { Button, Card, Dropdown, Input, Modal, Typography } from 'antd';
import { MessageSquare, MoreHorizontal } from 'lucide-react';
import ConversationSearch from './ConversationSearch';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

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
  const debouncedSearchText = useDebouncedValue(searchText, 220);
  const filteredSessions = useMemo(() => {
    const query = debouncedSearchText.trim().toLowerCase();
    const list = Array.isArray(sessions) ? sessions : [];
    if (!query) return list;
    return list.filter((session) => String(session.title || '').toLowerCase().includes(query));
  }, [sessions, debouncedSearchText]);

  const confirmDelete = (sessionId) => {
    Modal.confirm({
      title: 'Delete conversation?',
      content: 'This will remove the selected chat history.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => onDelete(sessionId),
      onCancel: () => {},
    });
  };

  const getSessionMenuItems = () => [
    { key: 'rename', label: 'Rename' },
    { key: 'delete', label: 'Delete', danger: true },
  ];

  const handleSessionMenuClick = (key, session) => {
    if (key === 'rename') {
      setEditingSessionId(session.id);
      setEditingSessionTitle(session.title);
      return;
    }

    if (key === 'delete') {
      confirmDelete(session.id);
    }
  };

  return (
    <Card
      title="Conversations"
      extra={<Button type="primary" size="small" icon={<MessageSquare size={14} />} onClick={onCreate}>New</Button>}
      className="chat-sessions-card"
      style={style}
      styles={{ body: { flex: 1, overflowY: 'auto', padding: 0 } }}
    >
      <ConversationSearch value={searchText} onChange={setSearchText} />
      <div className="conversation-list">
        {filteredSessions.length === 0 ? (
          <div className="conversation-empty-state">
            <MessageSquare size={22} aria-hidden="true" />
            <span>{searchText ? 'No conversations match your search.' : 'Start a new AI Tutor session.'}</span>
          </div>
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
            <Dropdown
              trigger={['click']}
              placement="bottomRight"
              menu={{
                items: getSessionMenuItems(),
                onClick: ({ key, domEvent }) => {
                  domEvent.stopPropagation();
                  handleSessionMenuClick(key, session);
                },
              }}
            >
              <Button
                className="session-item-menu-btn"
                type="text"
                size="small"
                icon={<MoreHorizontal size={17} />}
                onClick={(event) => event.stopPropagation()}
                aria-label="Conversation actions"
              />
            </Dropdown>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default ChatSessionsPanel;

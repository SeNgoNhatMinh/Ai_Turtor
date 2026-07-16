import { memo } from 'react';
import { Input, Typography } from 'antd';
import EntityActionMenu from '../../../../components/common/EntityActionMenu';
import { CHAT_TURN_LIMIT, formatSessionTime, getSessionQuestionCount } from './sessionUtils';

const { Text } = Typography;
const MENU_ITEMS = [
  { key: 'rename', label: 'Đổi tên' },
  { key: 'delete', label: 'Xóa', danger: true },
];

const ConversationItem = memo(function ConversationItem({
  session,
  isActive,
  isEditing,
  editingSessionTitle,
  setEditingSessionTitle,
  onSelect,
  onSaveRename,
  onMenuAction,
}) {
  const questionCount = getSessionQuestionCount(session);
  const isFull = Boolean(session.maxTurnsReached || questionCount >= CHAT_TURN_LIMIT);

  return (
    <div
      className={`session-item ${isActive ? 'ant-list-item-selected' : ''}`}
      onClick={() => onSelect(session.id, session.title)}
    >
      <div className="session-item-main">
        <div className="session-item-title">
          {isEditing ? (
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
            <Text ellipsis>{session.title || 'Cuộc trò chuyện mới'}</Text>
          )}
        </div>
        <div className="session-item-meta">
          <Text className="session-item-time">{formatSessionTime(session)}</Text>
          {questionCount > 0 && <span className="session-question-count">{questionCount}/{CHAT_TURN_LIMIT} câu hỏi</span>}
          {isFull && <span className="session-full-badge">Đã đầy</span>}
          {(session.courseId || session.classId) && (
            <span>{[session.courseId, session.classId].filter(Boolean).join(' / ')}</span>
          )}
        </div>
      </div>
      <EntityActionMenu
        items={MENU_ITEMS}
        onAction={(key, meta) => onMenuAction(key, session, meta)}
        ariaLabel="Thao tác cuộc trò chuyện"
      />
    </div>
  );
});

function ConversationGroup({
  group,
  activeSessionId,
  editingSessionId,
  editingSessionTitle,
  setEditingSessionTitle,
  onSelect,
  onSaveRename,
  onMenuAction,
}) {
  return (
    <section className="conversation-group" aria-label={group.label}>
      <div className="conversation-group-title">{group.label}</div>
      {group.items.map((session) => (
        <ConversationItem
          key={session.id}
          session={session}
          isActive={activeSessionId === session.id}
          isEditing={editingSessionId === session.id}
          editingSessionTitle={editingSessionTitle}
          setEditingSessionTitle={setEditingSessionTitle}
          onSelect={onSelect}
          onSaveRename={onSaveRename}
          onMenuAction={onMenuAction}
        />
      ))}
    </section>
  );
}

export default memo(ConversationGroup);

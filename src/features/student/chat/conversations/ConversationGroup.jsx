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
  sessionMutationKey,
}) {
  const questionCount = getSessionQuestionCount(session);
  const isFull = Boolean(session.maxTurnsReached || questionCount >= CHAT_TURN_LIMIT);
  const isMutating = String(sessionMutationKey || '').endsWith(`:${session.id}`);
  const canSelect = typeof onSelect === 'function' && !isEditing && !sessionMutationKey;
  const selectSession = () => {
    if (canSelect) onSelect(session.id, session.title);
  };

  return (
    <div
      className={`session-item ${isActive ? 'ant-list-item-selected' : ''}`}
      role="button"
      tabIndex={canSelect ? 0 : -1}
      aria-current={isActive ? 'true' : undefined}
      aria-disabled={!canSelect}
      onClick={selectSession}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectSession();
        }
      }}
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
              disabled={isMutating}
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
        disabled={Boolean(sessionMutationKey)}
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
  sessionMutationKey,
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
          sessionMutationKey={sessionMutationKey}
        />
      ))}
    </section>
  );
}

export default memo(ConversationGroup);

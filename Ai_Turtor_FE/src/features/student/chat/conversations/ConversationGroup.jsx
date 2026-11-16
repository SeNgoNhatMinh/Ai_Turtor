import { memo, useLayoutEffect, useRef, useState } from 'react';
import { Input, Typography } from 'antd';
import EntityActionMenu from '../../../../components/common/EntityActionMenu';
import { formatSessionTime, getSessionQuestionCount } from './sessionUtils';

const { Text } = Typography;
const MENU_ITEMS = [
  { key: 'rename', label: 'Đổi tên' },
  { key: 'delete', label: 'Xóa', danger: true },
];

function fullTitleWidth(sample, title) {
  const probe = document.createElement('span');
  const computed = getComputedStyle(sample);
  probe.textContent = title;
  probe.style.position = 'fixed';
  probe.style.left = '-10000px';
  probe.style.whiteSpace = 'nowrap';
  probe.style.font = computed.font;
  probe.style.letterSpacing = computed.letterSpacing;
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

function SessionTitleMarquee({ title }) {
  const trackRef = useRef(null);
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    const measure = () => {
      const extra = Math.ceil(fullTitleWidth(track, title) - track.clientWidth);
      setShift(extra > 4 ? extra + 8 : 0);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [title]);

  const duration = Math.max(1.2, shift / 42);

  return (
    <span
      className={`session-title-marquee${shift > 0 ? ' is-overflow' : ''}`}
      ref={trackRef}
      style={{
        '--marquee-shift': `${shift}px`,
        '--marquee-duration': `${duration.toFixed(2)}s`,
      }}
    >
      <span className="session-title-marquee__text">{title}</span>
    </span>
  );
}

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
            <SessionTitleMarquee title={session.title || 'Cuộc trò chuyện mới'} />
          )}
        </div>
        <div className="session-item-meta">
          <Text className="session-item-time">{formatSessionTime(session)}</Text>
          {questionCount > 0 && <span className="session-question-count">{questionCount} câu</span>}
        </div>
      </div>
      <EntityActionMenu
        items={MENU_ITEMS}
        onAction={(key) => onMenuAction(key, session)}
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

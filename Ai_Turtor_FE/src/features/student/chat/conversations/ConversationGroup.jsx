import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  probe.style.top = '0';
  probe.style.visibility = 'hidden';
  probe.style.whiteSpace = 'nowrap';
  probe.style.font = computed.font;
  probe.style.letterSpacing = computed.letterSpacing;
  document.body.appendChild(probe);
  const width = Math.ceil(probe.getBoundingClientRect().width);
  probe.remove();
  return width;
}

function SessionTitleMarquee({ title }) {
  const trackRef = useRef(null);
  const textRef = useRef(null);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const text = textRef.current;
    if (!track || !text) return undefined;

    const measure = () => {
      const extra = fullTitleWidth(text, title) - track.clientWidth;
      setOverflowing(extra > 4);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [title]);

  useEffect(() => {
    const track = trackRef.current;
    const text = textRef.current;
    const row = track?.closest('.session-item');
    if (!track || !text || !row) return undefined;

    const startScroll = () => {
      const extra = Math.ceil(fullTitleWidth(text, title) - track.clientWidth);
      if (extra <= 4) {
        track.dataset.overflow = 'false';
        return;
      }
      const shift = extra + 8;
      const travelSeconds = Math.max(1.15, shift / 80);
      track.dataset.overflow = 'true';
      track.style.setProperty('--marquee-shift', `${shift}px`);
      track.style.setProperty('--marquee-duration', `${(travelSeconds / 0.4).toFixed(2)}s`);
      text.style.animation = 'none';
      void text.offsetWidth;
      text.style.animation = '';
    };

    row.addEventListener('mouseenter', startScroll);
    return () => row.removeEventListener('mouseenter', startScroll);
  }, [title]);

  return (
    <span
      className="session-title-marquee"
      ref={trackRef}
      data-overflow={overflowing ? 'true' : 'false'}
    >
      <span className="session-title-marquee__text" ref={textRef}>{title}</span>
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

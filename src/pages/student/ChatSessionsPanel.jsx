import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Skeleton, Typography } from 'antd';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, Plus } from 'lucide-react';
import ConversationSearch from './ConversationSearch';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import EntityActionMenu from '../../components/common/EntityActionMenu';
import { confirmDanger } from '../../components/common/confirmDialog';

const { Text } = Typography;
const PAGE_SIZE = 50;
const CHAT_TURN_LIMIT = 10;

const toFiniteNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const getQuestionCount = (session) => {
  if (session?.userQuestionCount != null) return Math.min(CHAT_TURN_LIMIT, Math.max(0, toFiniteNumber(session.userQuestionCount)));
  if (session?.questionCount != null) return Math.min(CHAT_TURN_LIMIT, Math.max(0, toFiniteNumber(session.questionCount)));
  return Math.min(CHAT_TURN_LIMIT, Math.max(0, Math.floor(toFiniteNumber(session?.messageCount) / 2)));
};

const getActivityDate = (session) => {
  const value = session?.lastMessageAt || session?.updatedAt || session?.createdAt;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
};

const sortByActivity = (items) => {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => getActivityDate(b).getTime() - getActivityDate(a).getTime());
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getDayDiff = (date) => {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  return Math.floor((today.getTime() - target.getTime()) / 86400000);
};

const getTimeGroup = (session) => {
  const diff = getDayDiff(getActivityDate(session));
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff <= 7) return 'Previous 7 Days';
  if (diff <= 30) return 'Previous 30 Days';
  return 'Older';
};

const formatSessionTime = (session) => {
  const date = getActivityDate(session);
  if (!date.getTime()) return 'No messages yet';
  const diff = getDayDiff(date);
  if (diff <= 0) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const groupSessions = (sessions) => {
  const groups = new Map();
  sortByActivity(sessions).forEach((session) => {
    const group = getTimeGroup(session);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(session);
  });
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
};

function ConversationSkeleton() {
  return (
    <div className="conversation-skeleton-list" aria-label="Loading conversations">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="conversation-skeleton-item">
          <Skeleton.Input active size="small" style={{ width: index % 2 ? 138 : 174 }} />
          <Skeleton.Input active size="small" style={{ width: index % 2 ? 72 : 96 }} />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ isSearching }) {
  return (
    <div className="conversation-empty-state">
      <MessageSquare size={22} aria-hidden="true" />
      <span>{isSearching ? 'No conversations match your search.' : 'No conversations for this course yet.'}</span>
    </div>
  );
}

function ConversationMenu({ session, onAction }) {
  const items = [
    { key: 'rename', label: 'Rename' },
    { key: 'delete', label: 'Delete', danger: true },
  ];

  return (
    <EntityActionMenu
      items={items}
      onAction={(key, meta) => onAction(key, session, meta)}
      ariaLabel="Conversation actions"
    />
  );
}

function ConversationItem({
  session,
  isActive,
  isEditing,
  editingSessionTitle,
  setEditingSessionTitle,
  onSelect,
  onSaveRename,
  onMenuAction,
}) {
  const questionCount = getQuestionCount(session);
  const isFull = Boolean(session.maxTurnsReached || questionCount >= CHAT_TURN_LIMIT);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
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
            <Text ellipsis>{session.title || 'New conversation'}</Text>
          )}
        </div>
        <div className="session-item-meta">
          <Text className="session-item-time">{formatSessionTime(session)}</Text>
          {questionCount > 0 && <span className="session-question-count">{questionCount}/{CHAT_TURN_LIMIT} questions</span>}
          {isFull && <span className="session-full-badge">Full</span>}
          {(session.courseId || session.classId) && (
            <span>{[session.courseId, session.classId].filter(Boolean).join(' / ')}</span>
          )}
        </div>
      </div>
      <ConversationMenu session={session} onAction={onMenuAction} />
    </motion.div>
  );
}

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
      <AnimatePresence initial={false}>
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
      </AnimatePresence>
    </section>
  );
}

function ChatSessionsPanel({
  sessions,
  isLoading = false,
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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const debouncedSearchText = useDebouncedValue(searchText, 220);

  const filteredSessions = useMemo(() => {
    const query = debouncedSearchText.trim().toLowerCase();
    const list = sortByActivity(sessions);
    if (!query) return list;
    return list.filter((session) => String(session.title || '').toLowerCase().includes(query));
  }, [sessions, debouncedSearchText]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debouncedSearchText, sessions?.length]);

  const visibleSessions = filteredSessions.slice(0, visibleCount);
  const groupedSessions = useMemo(() => groupSessions(visibleSessions), [visibleSessions]);
  const hasMore = visibleCount < filteredSessions.length;

  const confirmDelete = (sessionId, anchorRect) => {
    confirmDanger({
      title: 'Delete conversation?',
      content: 'This will remove the selected chat history.',
      okText: 'Delete',
      cancelText: 'Cancel',
      anchorRect,
      onOk: () => onDelete(sessionId),
    });
  };

  const handleSessionMenuClick = (key, session, meta) => {
    if (key === 'rename') {
      setEditingSessionId(session.id);
      setEditingSessionTitle(session.title);
      return;
    }

    if (key === 'delete') {
      confirmDelete(session.id, meta?.anchorRect);
    }
  };

  const handleListScroll = (event) => {
    const target = event.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (distanceFromBottom < 80 && hasMore) {
      setVisibleCount((current) => Math.min(current + PAGE_SIZE, filteredSessions.length));
    }
  };

  return (
    <Card
      className="chat-sessions-card"
      style={style}
      styles={{ body: { flex: 1, overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' } }}
    >
      <div className="chat-history-header">
        <div>
          <div className="chat-history-title">Chat history</div>
          <div className="chat-history-subtitle">Sorted by latest activity</div>
        </div>
        <Button
          type="primary"
          size="small"
          icon={<Plus size={14} />}
          onClick={onCreate}
          className="chat-history-new-button"
        >
          New Chat
        </Button>
      </div>

      <ConversationSearch value={searchText} onChange={setSearchText} />

      <div className="conversation-list" onScroll={handleListScroll}>
        {isLoading ? (
          <ConversationSkeleton />
        ) : filteredSessions.length === 0 ? (
          <EmptyState isSearching={Boolean(searchText.trim())} />
        ) : (
          <>
            {groupedSessions.map((group) => (
              <ConversationGroup
                key={group.label}
                group={group}
                activeSessionId={activeSessionId}
                editingSessionId={editingSessionId}
                editingSessionTitle={editingSessionTitle}
                setEditingSessionTitle={setEditingSessionTitle}
                onSelect={onSelect}
                onSaveRename={onSaveRename}
                onMenuAction={handleSessionMenuClick}
              />
            ))}
            {hasMore && (
              <button
                type="button"
                className="conversation-load-more"
                onClick={() => setVisibleCount((current) => Math.min(current + PAGE_SIZE, filteredSessions.length))}
              >
                Load more conversations
              </button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

export default ChatSessionsPanel;

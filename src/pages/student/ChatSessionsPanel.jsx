import { useMemo, useState } from 'react';
import { Button, Card } from 'antd';
import { Plus } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { confirmDanger } from '../../components/common/confirmDialog';
import ConversationGroup from '../../features/student/chat/conversations/ConversationGroup';
import {
  ConversationEmptyState,
  ConversationSkeleton,
} from '../../features/student/chat/conversations/ConversationStates';
import {
  CONVERSATION_PAGE_SIZE,
  groupSessionsByTime,
  sortSessionsByActivity,
} from '../../features/student/chat/conversations/sessionUtils';
import ConversationSearch from './ConversationSearch';

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
  const [visibleCount, setVisibleCount] = useState(CONVERSATION_PAGE_SIZE);
  const debouncedSearchText = useDebouncedValue(searchText, 220);

  const filteredSessions = useMemo(() => {
    const query = debouncedSearchText.trim().toLowerCase();
    const sorted = sortSessionsByActivity(sessions);
    if (!query) return sorted;
    return sorted.filter((session) => String(session.title || '').toLowerCase().includes(query));
  }, [debouncedSearchText, sessions]);

  const visibleSessions = filteredSessions.slice(0, visibleCount);
  const groupedSessions = useMemo(() => groupSessionsByTime(visibleSessions), [visibleSessions]);
  const hasMore = visibleCount < filteredSessions.length;

  const handleSessionMenu = (key, session, meta) => {
    if (key === 'rename') {
      setEditingSessionId(session.id);
      setEditingSessionTitle(session.title);
      return;
    }
    if (key === 'delete') {
      confirmDanger({
        title: 'Delete conversation?',
        content: 'This will remove the selected chat history.',
        okText: 'Delete',
        cancelText: 'Cancel',
        anchorRect: meta?.anchorRect,
        onOk: () => onDelete(session.id),
      });
    }
  };

  const loadMore = () => {
    setVisibleCount((current) => Math.min(current + CONVERSATION_PAGE_SIZE, filteredSessions.length));
  };

  const handleListScroll = (event) => {
    const target = event.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (distanceFromBottom < 80 && hasMore) loadMore();
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
        <Button type="primary" size="small" icon={<Plus size={14} />} onClick={onCreate} className="chat-history-new-button">
          New Chat
        </Button>
      </div>

      <ConversationSearch
        value={searchText}
        onChange={(value) => {
          setSearchText(value);
          setVisibleCount(CONVERSATION_PAGE_SIZE);
        }}
      />

      <div className="conversation-list" onScroll={handleListScroll}>
        {isLoading ? (
          <ConversationSkeleton />
        ) : filteredSessions.length === 0 ? (
          <ConversationEmptyState isSearching={Boolean(searchText.trim())} />
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
                onMenuAction={handleSessionMenu}
              />
            ))}
            {hasMore && <button type="button" className="conversation-load-more" onClick={loadMore}>Load more conversations</button>}
          </>
        )}
      </div>
    </Card>
  );
}

export default ChatSessionsPanel;

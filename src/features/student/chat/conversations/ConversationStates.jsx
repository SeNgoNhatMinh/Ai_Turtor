import { memo } from 'react';
import { Skeleton } from 'antd';
import { MessageSquare } from 'lucide-react';

export const ConversationSkeleton = memo(function ConversationSkeleton() {
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
});

export const ConversationEmptyState = memo(function ConversationEmptyState({ isSearching }) {
  return (
    <div className="conversation-empty-state">
      <MessageSquare size={22} aria-hidden="true" />
      <span>{isSearching ? 'No conversations match your search.' : 'No conversations for this course yet.'}</span>
    </div>
  );
});

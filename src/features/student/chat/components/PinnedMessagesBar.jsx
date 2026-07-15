import { CloseOutlined, PushpinOutlined } from '@ant-design/icons';
import { getMessagePreview } from '../chatMessageUtils';

function PinnedMessagesBar({ messages, onJump, onToggle }) {
  if (!messages.length) return null;

  return (
    <div className="chat-pinned-topbar" aria-label="Pinned messages">
      <div className="chat-pinned-topbar-label">
        <PushpinOutlined />
        <span>Pinned</span>
        <em>{messages.length}/3</em>
      </div>
      <div className="chat-pinned-topbar-list">
        {messages.map(({ pinned, message, key, canJump }) => (
          <button
            key={pinned.messageId}
            type="button"
            className={`chat-pinned-topbar-item ${!canJump ? 'chat-pinned-topbar-item--disabled' : ''}`}
            onClick={() => canJump && onJump(key)}
            title={canJump ? 'Jump to pinned message' : 'Pinned message is not in the loaded message window'}
          >
            <span>{getMessagePreview(message) || 'Pinned message'}</span>
            <CloseOutlined
              className="chat-pinned-unpin"
              title="Unpin message"
              onClick={(event) => {
                event.stopPropagation();
                onToggle({ assistantMessageId: pinned.messageId });
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default PinnedMessagesBar;

import { CloseOutlined, PushpinOutlined } from '@ant-design/icons';
import { getMessagePreview } from '../chatMessageUtils';

function PinnedMessagesBar({ messages, onJump, onToggle }) {
  if (!messages.length) return null;

  return (
    <div className="chat-pinned-topbar" aria-label="Tin nhắn đã ghim">
      <div className="chat-pinned-topbar-label">
        <PushpinOutlined />
        <span>Đã ghim</span>
        <em>{messages.length}/3</em>
      </div>
      <div className="chat-pinned-topbar-list">
        {messages.map(({ pinned, message, key, canJump }) => (
          <button
            key={pinned.messageId}
            type="button"
            className={`chat-pinned-topbar-item ${!canJump ? 'chat-pinned-topbar-item--disabled' : ''}`}
            onClick={() => canJump && onJump(key)}
            title={canJump ? 'Chuyển đến tin nhắn đã ghim' : 'Tin nhắn đã ghim chưa có trong phần lịch sử đang tải'}
          >
            <span>{getMessagePreview(message) || 'Tin nhắn đã ghim'}</span>
            <CloseOutlined
              className="chat-pinned-unpin"
              title="Bỏ ghim tin nhắn"
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

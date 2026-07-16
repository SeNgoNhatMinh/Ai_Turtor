import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Empty, Input, Rate, Spin, Tag } from 'antd';
import { MessageCircle, RefreshCw, Send, XCircle } from 'lucide-react';
import { useSupportChatRoom } from '../../hooks/useSupportChatRoom';
import './SupportChatRoom.css';

function SupportChatRoom({
  chatRoomId,
  currentUser,
  allowClose = false,
  onClosed,
  compact = false,
}) {
  const [draft, setDraft] = useState('');
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const endRef = useRef(null);
  const {
    messages,
    detail,
    isLoading,
    isSending,
    isClosing,
    error,
    connectionState,
    senderRole,
    loadRoom,
    sendMessage,
    closeRoom,
  } = useSupportChatRoom({ chatRoomId, currentUser });

  const isClosed = String(detail?.status || '').toUpperCase() === 'CLOSED';

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  const submitMessage = async () => {
    if (await sendMessage(draft)) setDraft('');
  };

  const submitClose = async () => {
    const closed = await closeRoom({ rating, feedback });
    if (closed) {
      setShowCloseForm(false);
      onClosed?.();
    }
  };

  return (
    <section className={`support-chat-room ${compact ? 'is-compact' : ''}`} aria-label="Trò chuyện hỗ trợ với giáo viên">
      <div className="support-chat-room__header">
        <div>
          <strong><MessageCircle size={16} /> {detail?.mentorName || detail?.userName || 'Trò chuyện hỗ trợ'}</strong>
          <span>{senderRole === 'STUDENT' ? 'Trao đổi với giáo viên' : `Sinh viên: ${detail?.userName || 'Sinh viên'}`}</span>
        </div>
        <div className="support-chat-room__status">
          <Tag color={isClosed ? 'default' : 'green'}>{isClosed ? 'Đã đóng' : 'Đang hoạt động'}</Tag>
          <span className={`support-chat-socket is-${connectionState}`}>
            {connectionState === 'connected' ? 'Trực tiếp' : 'Tự làm mới'}
          </span>
          <Button type="text" size="small" icon={<RefreshCw size={14} />} onClick={() => loadRoom()} aria-label="Làm mới trò chuyện hỗ trợ" />
        </div>
      </div>

      {error && <Alert type="error" showIcon message={error} />}

      <div className="support-chat-room__messages" aria-live="polite">
        {isLoading ? (
          <div className="support-chat-room__loading"><Spin size="small" /> Đang tải tin nhắn...</div>
        ) : messages.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có tin nhắn. Hãy bắt đầu bằng cách mô tả nội dung bạn cần hỗ trợ." />
        ) : messages.map((message) => {
          const mine = String(message.senderRole || '').toUpperCase() === senderRole;
          return (
            <article key={message.messageId || `${message.senderId}-${message.sentAt}`} className={`support-chat-message ${mine ? 'is-mine' : ''}`}>
              <span>{mine ? 'Bạn' : message.senderName || (message.senderRole === 'MENTOR' ? 'Giáo viên' : 'Sinh viên')}</span>
              <p>{message.content}</p>
              <time>{message.sentAt ? new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</time>
            </article>
          );
        })}
        <div ref={endRef} />
      </div>

      {!isClosed && (
        <div className="support-chat-room__composer">
          <Input.TextArea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={senderRole === 'STUDENT' ? 'Mô tả nội dung bạn vẫn cần hỗ trợ...' : 'Trả lời sinh viên...'}
            autoSize={{ minRows: 1, maxRows: 4 }}
            maxLength={10000}
            onPressEnter={(event) => {
              if (!event.shiftKey) {
                event.preventDefault();
                submitMessage();
              }
            }}
            disabled={isSending}
          />
          <Button type="primary" icon={<Send size={15} />} loading={isSending} disabled={!draft.trim()} onClick={submitMessage} aria-label="Gửi tin nhắn hỗ trợ" />
        </div>
      )}

      {allowClose && !isClosed && (
        <div className="support-chat-room__close">
          {!showCloseForm ? (
            <Button type="text" danger icon={<XCircle size={15} />} onClick={() => setShowCloseForm(true)}>Đóng và đánh giá</Button>
          ) : (
            <div className="support-chat-close-form">
              <div><span>Phần hỗ trợ này hữu ích ở mức nào?</span><Rate value={rating} onChange={setRating} /></div>
              <Input.TextArea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Góp ý thêm (không bắt buộc)" maxLength={1000} autoSize={{ minRows: 2, maxRows: 3 }} />
              <div>
                <Button onClick={() => setShowCloseForm(false)}>Hủy</Button>
                <Button type="primary" loading={isClosing} onClick={submitClose}>Đóng trò chuyện</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default SupportChatRoom;

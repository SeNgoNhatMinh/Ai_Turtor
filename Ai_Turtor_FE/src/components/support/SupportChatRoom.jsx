import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Empty, Input, Rate, Spin, Tag } from 'antd';
import { BookPlus, MessageCircle, RefreshCw, Send, XCircle } from 'lucide-react';
import { useSupportChatRoom } from '../../hooks/useSupportChatRoom';
import { isRichTextEmpty, looksLikeRichHtml, sanitizeRichHtml } from '../../utils/richText';
import SupportRichTextEditor from './SupportRichTextEditor';
import './SupportChatRoom.css';

function SupportMessageBody({ content }) {
  if (looksLikeRichHtml(content)) {
    return (
      <div
        className="support-chat-message__body is-rich"
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(content) }}
      />
    );
  }
  return <p className="support-chat-message__body">{content}</p>;
}

function SupportChatRoom({
  chatRoomId,
  currentUser,
  allowClose = false,
  onClosed,
  onAnswerIndexed,
  compact = false,
  readOnly = false,
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
    sendAnswerAndIndex,
    closeRoom,
  } = useSupportChatRoom({ chatRoomId, currentUser, realtimeEnabled: !readOnly });

  const isClosed = String(detail?.status || '').toUpperCase() === 'CLOSED';
  const canCompose = !readOnly && !isClosed;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  const outgoingContent = senderRole === 'MENTOR' ? sanitizeRichHtml(draft) : draft;
  const canSend = !isRichTextEmpty(outgoingContent);

  const submitMessage = async () => {
    if (await sendMessage(outgoingContent)) setDraft('');
  };

  const submitAnswerAndIndex = async () => {
    const result = await sendAnswerAndIndex(outgoingContent);
    if (!result) return;
    setDraft('');
    onAnswerIndexed?.(result);
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
          <Tag color={isClosed || readOnly ? 'default' : 'green'}>
            {isClosed || readOnly ? 'Lịch sử trao đổi' : 'Đang hoạt động'}
          </Tag>
          <span className={`support-chat-socket is-${connectionState}`}>
            {connectionState === 'connected' ? 'Trực tiếp' : 'Tự làm mới'}
          </span>
          <Button type="text" size="small" icon={<RefreshCw size={14} />} onClick={() => loadRoom()} aria-label="Làm mới trò chuyện hỗ trợ" />
        </div>
      </div>

      {error && <Alert type="error" showIcon title={error} />}

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
              <SupportMessageBody content={message.content} />
              <time>{message.sentAt ? new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</time>
            </article>
          );
        })}
        <div ref={endRef} />
      </div>

      {canCompose && (
        <div className={`support-chat-room__composer ${senderRole === 'MENTOR' ? 'is-rich' : ''}`}>
          {senderRole === 'MENTOR' ? (
            <SupportRichTextEditor
              value={draft}
              onChange={setDraft}
              onSubmit={submitMessage}
              placeholder="Trả lời sinh viên..."
              disabled={isSending}
            />
          ) : (
            <Input.TextArea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Mô tả nội dung bạn vẫn cần hỗ trợ..."
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
          )}
          <div className="support-chat-room__actions">
            <Button
              type="primary"
              icon={<Send size={15} />}
              loading={isSending}
              disabled={!canSend}
              onClick={submitMessage}
              title={canSend ? 'Gửi tin nhắn hỗ trợ' : 'Nhập nội dung rồi bấm Gửi'}
              aria-label="Gửi tin nhắn hỗ trợ"
            >
              Gửi
            </Button>
            {senderRole === 'MENTOR' && (
              <Button
                icon={<BookPlus size={15} />}
                loading={isSending}
                disabled={!canSend}
                onClick={submitAnswerAndIndex}
                title={canSend ? 'Gửi đáp án và tạo đề xuất cho senior' : 'Nhập nội dung rồi bấm gửi'}
                aria-label="Gửi đáp án cho sinh viên và tạo đề xuất tri thức cho senior duyệt"
              >
                Gửi + gửi senior duyệt
              </Button>
            )}
          </div>
        </div>
      )}
      {canCompose && senderRole === 'MENTOR' && (
        <p className="support-chat-room__hint">
          Nút “Gửi + gửi senior duyệt” dùng cùng nội dung vừa viết: sinh viên nhận đáp án trong chat, senior nhận đề xuất index. Không ghi lại lần hai.
        </p>
      )}

      {allowClose && canCompose && (
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

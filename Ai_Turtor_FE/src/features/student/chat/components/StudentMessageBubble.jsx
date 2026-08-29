import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Pencil, Send, X } from 'lucide-react';
import { PushpinOutlined } from '@ant-design/icons';
import { LIMITS, validateChatInput } from '../../../../utils/validators';
import StudentMessageContent from './StudentMessageContent';

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard is unavailable');
}

export default function StudentMessageBubble({
  canResend,
  isPinned,
  onResend,
  question,
  triggerToast,
}) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(question || ''));
  const textareaRef = useRef(null);
  const copiedTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(copiedTimerRef.current), []);

  useEffect(() => {
    if (!isEditing) return;
    textareaRef.current?.focus();
  }, [isEditing]);

  const handleCopy = async () => {
    try {
      await copyText(String(question || ''));
      setCopied(true);
      window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      triggerToast?.('Không thể sao chép tin nhắn.');
    }
  };

  const cancelEdit = () => {
    setDraft(String(question || ''));
    setIsEditing(false);
  };

  const openEdit = () => {
    setDraft(String(question || ''));
    setIsEditing(true);
  };

  const submitEdit = () => {
    const validation = validateChatInput(draft);
    if (!validation.ok) {
      triggerToast?.(validation.message);
      return;
    }
    onResend?.(validation.value);
    setIsEditing(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canResend) submitEdit();
    }
  };

  if (isEditing) {
    return (
      <div className="student-message-editor">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={LIMITS.chatMax}
          rows={3}
          aria-label="Chỉnh sửa câu hỏi"
        />
        <div className="student-message-editor__actions">
          <button type="button" className="student-message-editor__cancel" onClick={cancelEdit}>
            <X size={15} /> Hủy
          </button>
          <button type="button" className="student-message-editor__submit" onClick={submitEdit} disabled={!canResend}>
            <Send size={15} /> Gửi lại
          </button>
        </div>
        <small>Tin nhắn cũ vẫn được giữ trong lịch sử.</small>
      </div>
    );
  }

  return (
    <div className="student-message-group">
      <div className={`chat-gpt-bubble-user ${isPinned ? 'chat-message-pinned' : ''}`}>
        {isPinned && <PushpinOutlined className="chat-message-pin-badge" />}
        <StudentMessageContent text={question} />
      </div>
      <div className="student-message-actions" aria-label="Thao tác tin nhắn">
        <button type="button" onClick={handleCopy} title={copied ? 'Đã sao chép' : 'Sao chép'} aria-label={copied ? 'Đã sao chép' : 'Sao chép tin nhắn'}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
        <button type="button" onClick={openEdit} disabled={!canResend} title="Sửa và gửi lại" aria-label="Sửa và gửi lại tin nhắn">
          <Pencil size={15} />
        </button>
      </div>
    </div>
  );
}

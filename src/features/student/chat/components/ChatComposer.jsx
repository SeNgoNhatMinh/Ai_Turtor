import { useEffect, useRef } from 'react';
import { SendOutlined, StopOutlined } from '@ant-design/icons';
import { validateChatInput } from '../../../../utils/validators';

function ChatComposer({
  activeSessionMaxTurnsReached,
  canChat,
  chatContextMessage,
  chatInput,
  isAiLoading,
  onSend,
  onStop,
  setChatInput,
  triggerToast,
}) {
  const textareaRef = useRef(null);
  const fullMessage = 'This chat is full. Start a new chat to continue.';
  const sendDisabled = !canChat || !validateChatInput(chatInput).ok || activeSessionMaxTurnsReached;

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
  }, [chatInput]);

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    if (!canChat) {
      triggerToast?.(chatContextMessage);
      return;
    }
    if (activeSessionMaxTurnsReached) {
      triggerToast?.(fullMessage);
      return;
    }
    const validation = validateChatInput(chatInput);
    if (!validation.ok) {
      triggerToast?.(validation.message);
      return;
    }
    onSend?.();
  };

  const placeholder = !canChat
    ? chatContextMessage
    : activeSessionMaxTurnsReached
      ? fullMessage
      : isAiLoading
        ? 'AI Tutor is responding...'
        : 'Message AI Tutor...';

  return (
    <div className="chat-workspace-input-area">
      <div className="chat-workspace-input-inner">
        <div className="chat-gpt-input-wrapper">
          <textarea
            ref={textareaRef}
            placeholder={placeholder}
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={8000}
            disabled={isAiLoading || !canChat}
            rows={1}
          />
          {isAiLoading ? (
            <button className="chat-gpt-send-btn" onClick={onStop} title="Stop generating" type="button">
              <StopOutlined />
            </button>
          ) : (
            <button
              className="chat-gpt-send-btn"
              onClick={onSend}
              disabled={sendDisabled}
              title={!canChat ? chatContextMessage : activeSessionMaxTurnsReached ? fullMessage : 'Send message'}
              type="button"
            >
              <SendOutlined />
            </button>
          )}
        </div>
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: '#888' }}>
          AI Tutor can make mistakes. Consider verifying important information.
        </div>
      </div>
    </div>
  );
}

export default ChatComposer;

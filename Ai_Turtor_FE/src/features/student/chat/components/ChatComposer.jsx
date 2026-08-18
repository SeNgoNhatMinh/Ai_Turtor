import { useCallback, useEffect, useRef } from 'react';
import { SendOutlined, StopOutlined } from '@ant-design/icons';
import { Mic, MicOff } from 'lucide-react';
import { LIMITS, validateChatInput } from '../../../../utils/validators';
import { uiCopy } from '../../../../constants/uiCopy';
import { useSpeechToText } from '../useSpeechToText';

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
  const speechBaseTextRef = useRef('');
  const fullMessage = 'Cuộc trò chuyện đã đủ 10 câu hỏi. Hãy tạo cuộc trò chuyện mới.';
  const sendDisabled = !canChat || !validateChatInput(chatInput).ok || activeSessionMaxTurnsReached;
  const speechDisabled = isAiLoading || !canChat || activeSessionMaxTurnsReached;

  const handleSpeechTranscript = useCallback((transcript) => {
    const baseText = speechBaseTextRef.current.trim();
    const nextText = [baseText, transcript].filter(Boolean).join(' ').slice(0, LIMITS.chatMax);
    setChatInput(nextText);
  }, [setChatInput]);

  const {
    isListening,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
  } = useSpeechToText({
    disabled: speechDisabled,
    language: 'vi-VN',
    onError: triggerToast,
    onTranscript: handleSpeechTranscript,
  });

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
    if (isListening) stopListening();
    onSend?.();
  };

  const handleSpeechToggle = () => {
    if (isListening) {
      stopListening();
      return;
    }
    speechBaseTextRef.current = chatInput.trimEnd();
    startListening();
  };

  const handleInputChange = (event) => {
    if (isListening) stopListening();
    setChatInput(event.target.value);
  };

  const handleSend = () => {
    if (isListening) stopListening();
    onSend?.();
  };

  const placeholder = !canChat
    ? chatContextMessage
    : activeSessionMaxTurnsReached
      ? fullMessage
      : isAiLoading
        ? 'AI Tutor đang trả lời...'
        : 'Nhập câu hỏi cho AI Tutor...';

  return (
    <div className="chat-workspace-input-area">
      <div className="chat-workspace-input-inner">
        <div className="chat-gpt-input-wrapper">
          <textarea
            ref={textareaRef}
            data-chat-composer-input="true"
            placeholder={placeholder}
            value={chatInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            maxLength={LIMITS.chatMax}
            disabled={isAiLoading || !canChat}
            rows={1}
            aria-label="Câu hỏi cho AI Tutor"
          />
          <button
            className={`chat-gpt-tool-btn ${isListening ? 'is-listening' : ''}`}
            onClick={handleSpeechToggle}
            disabled={speechDisabled || !isSpeechSupported}
            title={isSpeechSupported
              ? (isListening ? 'Dừng nhập bằng giọng nói' : 'Nhập bằng giọng nói')
              : 'Trình duyệt không hỗ trợ nhập bằng giọng nói'}
            aria-label={isSpeechSupported
              ? (isListening ? 'Dừng nhập bằng giọng nói' : 'Bắt đầu nhập bằng giọng nói')
              : 'Trình duyệt không hỗ trợ nhập bằng giọng nói'}
            aria-pressed={isListening}
            type="button"
          >
            {isListening ? <MicOff size={17} /> : <Mic size={17} />}
          </button>
          {isAiLoading ? (
            <button className="chat-gpt-send-btn" onClick={onStop} title="Dừng tạo câu trả lời" type="button">
              <StopOutlined />
            </button>
          ) : (
            <button
              className="chat-gpt-send-btn"
              onClick={handleSend}
              disabled={sendDisabled}
              title={!canChat ? chatContextMessage : activeSessionMaxTurnsReached ? fullMessage : 'Gửi tin nhắn'}
              type="button"
            >
              <SendOutlined />
            </button>
          )}
        </div>
        <div className="chat-composer-meta" aria-live="polite">
          {isListening && <span className="chat-speech-status">Đang nghe...</span>}
          {canChat && (
            <span className="chat-composer-keyword-tip">{uiCopy.student.chat.keywordTip}</span>
          )}
          <span>AI Tutor có thể trả lời sai. Hãy kiểm tra lại thông tin quan trọng.</span>
        </div>
      </div>
    </div>
  );
}

export default ChatComposer;

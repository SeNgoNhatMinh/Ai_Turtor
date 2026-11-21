import { useEffect, useState } from 'react';
import { ArrowDown } from 'lucide-react';

const SHOW_AFTER_PX = 240;

/** ChatGPT-style "jump to latest" button, shown once the student scrolls away from the bottom. */
export default function ScrollToBottomButton({ messagesEndRef, watch }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = messagesEndRef?.current?.closest('.chat-workspace-messages-container');
    if (!container) return undefined;
    const update = () => {
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
      setVisible(distance > SHOW_AFTER_PX);
    };
    update();
    container.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      container.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [messagesEndRef, watch]);

  const scrollToBottom = () => {
    const container = messagesEndRef?.current?.closest('.chat-workspace-messages-container');
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  };

  return (
    <div className="chat-scroll-bottom-dock" aria-hidden={!visible}>
      <button
        type="button"
        className={`chat-scroll-bottom ${visible ? 'is-visible' : ''}`}
        onClick={scrollToBottom}
        tabIndex={visible ? 0 : -1}
        aria-label="Cuộn xuống tin nhắn mới nhất"
        title="Cuộn xuống cuối"
      >
        <ArrowDown size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { LoadingOutlined } from '@ant-design/icons';

const STEPS = ['Đang đọc câu hỏi', 'Đang tìm trong tài liệu môn học', 'Đang tạo câu trả lời'];

function ChatLoadingSteps() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStepIndex((current) => (current + 1) % STEPS.length);
    }, 1400);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="chat-loading-steps">
      <LoadingOutlined spin aria-hidden="true" />
      <div>
        <span>{STEPS[stepIndex]}</span>
        <small>AI Tutor đang chuẩn bị câu trả lời.</small>
        <div className="markdown-skeleton" aria-hidden="true">
          <span className="markdown-skeleton-line wide" />
          <span className="markdown-skeleton-line medium" />
          <span className="markdown-skeleton-line short" />
        </div>
      </div>
    </div>
  );
}

export default ChatLoadingSteps;

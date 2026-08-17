import { useEffect, useState } from 'react';
import { LoadingOutlined } from '@ant-design/icons';

const STEPS = ['Đang đọc câu hỏi', 'Đang tìm trong tài liệu môn học', 'Đang soạn câu trả lời'];

function ChatLoadingSteps() {
  const [stepIndex, setStepIndex] = useState(0);
  const [isTakingLonger, setIsTakingLonger] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
    }, 2200);
    const fallbackTimer = window.setTimeout(() => setIsTakingLonger(true), 10000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <div className="chat-loading-steps" role="status" aria-live="polite">
      <LoadingOutlined spin aria-hidden="true" />
      <div>
        <span>{STEPS[stepIndex]}</span>
        <small>
          {isTakingLonger
            ? 'Yêu cầu đang mất thêm thời gian để truy xuất và kiểm tra tài liệu môn học.'
            : 'AI Tutor đang chuẩn bị câu trả lời.'}
        </small>
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

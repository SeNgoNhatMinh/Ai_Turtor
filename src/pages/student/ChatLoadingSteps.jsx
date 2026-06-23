import React, { useEffect, useState } from 'react';
import { LoadingOutlined } from '@ant-design/icons';

const STEPS = ['Reading your question', 'Searching course materials', 'Generating answer'];

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
        <small>AI Tutor is preparing your response.</small>
      </div>
    </div>
  );
}

export default ChatLoadingSteps;

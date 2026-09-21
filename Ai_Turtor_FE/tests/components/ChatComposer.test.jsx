import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChatComposer from '../../src/features/student/chat/components/ChatComposer';

let recognitionInstance;

class MockSpeechRecognition {
  constructor() {
    recognitionInstance = this;
  }

  start() {
    this.onstart?.();
  }

  stop() {
    this.onend?.();
  }

  abort() {
    this.onend?.();
  }

  emitTranscript(transcript) {
    const result = [{ transcript }];
    result.isFinal = true;
    this.onresult?.({ results: [result] });
  }
}

function ComposerHarness({ onSend = vi.fn(), triggerToast = vi.fn() }) {
  const [value, setValue] = useState('Nội dung cũ');
  const [mode, setMode] = useState('RAG');
  return (
    <ChatComposer
      activeSessionMaxTurnsReached={false}
      canChat
      chatContextMessage=""
      chatInput={value}
      chatMode={mode}
      isAiLoading={false}
      onSend={onSend}
      onStop={vi.fn()}
      setChatInput={setValue}
      setChatMode={setMode}
      triggerToast={triggerToast}
    />
  );
}

afterEach(() => {
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
  recognitionInstance = undefined;
});

describe('ChatComposer speech input', () => {
  it('appends Vietnamese speech to the draft without sending automatically', () => {
    window.webkitSpeechRecognition = MockSpeechRecognition;
    const onSend = vi.fn();
    render(<ComposerHarness onSend={onSend} />);

    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu nhập bằng giọng nói' }));
    expect(screen.getByText('Đang nghe...')).toBeInTheDocument();

    act(() => recognitionInstance.emitTranscript('giải thích lập trình hướng đối tượng'));

    expect(screen.getByRole('textbox', { name: 'Câu hỏi cho AI Tutor' }))
      .toHaveValue('Nội dung cũ giải thích lập trình hướng đối tượng');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('keeps manual chat available when the browser has no speech recognition API', () => {
    render(<ComposerHarness />);

    expect(screen.getByRole('button', { name: 'Trình duyệt không hỗ trợ nhập bằng giọng nói' }))
      .toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Câu hỏi cho AI Tutor' })).toBeEnabled();
  });

  it('switches support mode directly above the chat input', () => {
    render(<ComposerHarness />);

    const modeSelect = screen.getByRole('combobox', { name: 'Chọn chế độ hỗ trợ' });
    const chatInput = screen.getByRole('textbox', { name: 'Câu hỏi cho AI Tutor' });
    expect(modeSelect.compareDocumentPosition(chatInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.mouseDown(modeSelect);
    fireEvent.click(screen.getByText('Hỗ trợ về code'));
    expect(modeSelect.closest('.ant-select')).toHaveTextContent('Hỗ trợ về code');
  });
});


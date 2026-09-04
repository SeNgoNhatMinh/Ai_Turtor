import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TtsMessageAction from '../../src/features/student/chat/components/TtsMessageAction';

const speech = (status, extra = {}) => ({
  messageKey: 'answer-1',
  status,
  currentTime: 0,
  duration: 12,
  error: '',
  hasAudio: status === 'playing' || status === 'paused',
  ...extra,
});

describe('TtsMessageAction', () => {
  it.each([
    ['idle', 'Đọc'],
    ['loading', 'Đang tạo giọng...'],
    ['playing', 'Tạm dừng'],
    ['paused', 'Tiếp tục'],
  ])('renders the %s state', (status, label) => {
    render(
      <TtsMessageAction
        messageKey="answer-1"
        speech={speech(status)}
        onToggle={vi.fn()}
        onStop={vi.fn()}
        onSeek={vi.fn()}
      />,
    );

    expect(screen.getByText(label)).toBeVisible();
  });

  it('offers stop and progress controls only after audio exists', () => {
    const onStop = vi.fn();
    render(
      <TtsMessageAction
        messageKey="answer-1"
        speech={speech('playing', { currentTime: 3 })}
        onToggle={vi.fn()}
        onStop={onStop}
        onSeek={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dừng đọc câu trả lời' }));
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('slider', { name: 'Vị trí phát giọng đọc' })).toBeVisible();
  });

  it('shows a generation failure without throwing or replacing the answer', () => {
    render(
      <div>
        <p>Câu trả lời văn bản vẫn hiển thị.</p>
        <TtsMessageAction
          messageKey="answer-1"
          speech={speech('failed', { error: 'Không thể tạo giọng đọc.' })}
          onToggle={vi.fn()}
          onStop={vi.fn()}
          onSeek={vi.fn()}
        />
      </div>,
    );

    expect(screen.getByText('Câu trả lời văn bản vẫn hiển thị.')).toBeVisible();
    expect(screen.getByText('Không thể tạo giọng đọc.')).toBeVisible();
  });
});

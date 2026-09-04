import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMessageAudio } from '../../src/features/student/chat/useMessageAudio';
import { ttsApi } from '../../src/services/ttsApi';

vi.mock('../../src/services/ttsApi', () => ({
  ttsApi: { readAiAnswer: vi.fn() },
}));

const request = (messageKey) => ({
  messageKey,
  messageId: `${messageKey}-id`,
  courseId: 'PRJ301',
  classId: 'SE1832',
  text: 'Câu trả lời AI',
  providerVoiceId: 'Magpie-Multilingual.VI-VN.Long.Neutral',
});

describe('useMessageAudio', () => {
  let audioInstances;

  beforeEach(() => {
    vi.clearAllMocks();
    audioInstances = [];
    let objectUrlIndex = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:tts-${++objectUrlIndex}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    class FakeAudio {
      constructor(src) {
        this.src = src;
        this.paused = true;
        this.ended = false;
        this.currentTime = 0;
        this.duration = 20;
        this.pause = vi.fn(() => {
          this.paused = true;
          this.onpause?.();
        });
        this.play = vi.fn(async () => {
          this.paused = false;
          this.onplay?.();
        });
        this.removeAttribute = vi.fn();
        this.load = vi.fn();
        audioInstances.push(this);
      }
    }
    vi.stubGlobal('Audio', FakeAudio);
  });

  it('supports play, pause, and resume states', async () => {
    ttsApi.readAiAnswer.mockResolvedValue(new Blob(['wav'], { type: 'audio/wav' }));
    const { result } = renderHook(() => useMessageAudio('conversation-1'));

    await act(async () => result.current.toggle(request('message-1')));
    expect(result.current.state.status).toBe('playing');
    expect(ttsApi.readAiAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ providerVoiceId: 'Magpie-Multilingual.VI-VN.Long.Neutral' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    await act(async () => result.current.toggle(request('message-1')));
    expect(result.current.state.status).toBe('paused');

    await act(async () => result.current.toggle(request('message-1')));
    expect(result.current.state.status).toBe('playing');
    expect(ttsApi.readAiAnswer).toHaveBeenCalledTimes(1);
  });

  it('stops and releases the old audio when another message starts and on unmount', async () => {
    ttsApi.readAiAnswer.mockResolvedValue(new Blob(['wav'], { type: 'audio/wav' }));
    const { result, unmount } = renderHook(() => useMessageAudio('conversation-1'));

    await act(async () => result.current.toggle(request('message-1')));
    await act(async () => result.current.toggle(request('message-2')));

    expect(audioInstances[0].pause).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:tts-1');
    expect(result.current.state.messageKey).toBe('message-2');

    unmount();
    expect(audioInstances[1].pause).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:tts-2');
  });

  it('keeps the hook usable and exposes a non-blocking error when the API fails', async () => {
    ttsApi.readAiAnswer.mockRejectedValue(new Error('service unavailable'));
    const { result } = renderHook(() => useMessageAudio('conversation-1'));

    await act(async () => result.current.toggle(request('message-1')));

    expect(result.current.state.status).toBe('failed');
    expect(result.current.state.error).toBeTruthy();
  });
});

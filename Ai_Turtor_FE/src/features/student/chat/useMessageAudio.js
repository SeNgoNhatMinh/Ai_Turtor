import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserFacingError } from '../../../services/apiClient';
import { ttsApi } from '../../../services/ttsApi';

const EMPTY_STATE = {
  scopeKey: '',
  messageKey: '',
  status: 'idle',
  currentTime: 0,
  duration: 0,
  error: '',
  hasAudio: false,
};

export function useMessageAudio(scopeKey = '') {
  const [state, setState] = useState(EMPTY_STATE);
  const activeRef = useRef(null);

  const dispose = useCallback(() => {
    const active = activeRef.current;
    activeRef.current = null;
    if (!active) return;
    active.controller?.abort();
    if (active.audio) {
      active.audio.pause();
      active.audio.removeAttribute('src');
      active.audio.load?.();
    }
    if (active.url) URL.revokeObjectURL(active.url);
  }, []);

  const reset = useCallback(() => {
    dispose();
    setState(EMPTY_STATE);
  }, [dispose]);

  useEffect(() => {
    return dispose;
  }, [scopeKey, dispose]);

  const playExisting = useCallback(async (active) => {
    if (!active?.audio) return;
    try {
      await active.audio.play();
    } catch {
      if (activeRef.current === active) {
        setState((current) => ({ ...current, status: 'paused' }));
      }
    }
  }, []);

  const toggle = useCallback(async ({ messageKey, messageId, text, courseId, classId, providerVoiceId }) => {
    const current = activeRef.current;
    if (current?.messageKey === messageKey && current.audio) {
      if (!current.audio.paused) current.audio.pause();
      else await playExisting(current);
      return;
    }
    if (current?.messageKey === messageKey && !current.audio) return;

    dispose();
    const controller = new AbortController();
    const active = { messageKey, controller, audio: null, url: '' };
    activeRef.current = active;
    setState({ ...EMPTY_STATE, scopeKey, messageKey, status: 'loading' });

    try {
      const blob = await ttsApi.readAiAnswer(
        { messageId, courseId, classId, text, providerVoiceId },
        { signal: controller.signal },
      );
      if (controller.signal.aborted || activeRef.current !== active) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      active.url = url;
      active.audio = audio;
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        if (activeRef.current !== active) return;
        setState((value) => ({ ...value, duration: Number.isFinite(audio.duration) ? audio.duration : 0 }));
      };
      audio.ontimeupdate = () => {
        if (activeRef.current !== active) return;
        setState((value) => ({ ...value, currentTime: audio.currentTime || 0 }));
      };
      audio.onplay = () => {
        if (activeRef.current === active) setState((value) => ({ ...value, status: 'playing', error: '' }));
      };
      audio.onpause = () => {
        if (activeRef.current === active && !audio.ended) {
          setState((value) => ({ ...value, status: 'paused' }));
        }
      };
      audio.onended = () => {
        if (activeRef.current !== active) return;
        audio.currentTime = 0;
        setState((value) => ({ ...value, status: 'idle', currentTime: 0 }));
      };
      audio.onerror = () => {
        if (activeRef.current === active) {
          setState((value) => ({ ...value, status: 'failed', error: 'Không thể phát file giọng đọc.' }));
        }
      };
      setState({ ...EMPTY_STATE, scopeKey, messageKey, status: 'paused', hasAudio: true });
      await playExisting(active);
    } catch (error) {
      if (controller.signal.aborted || activeRef.current !== active) return;
      setState({
        ...EMPTY_STATE,
        scopeKey,
        messageKey,
        status: 'failed',
        error: getUserFacingError(error, 'Không thể tạo giọng đọc lúc này. Vui lòng thử lại sau.'),
      });
    }
  }, [dispose, playExisting, scopeKey]);

  const stop = useCallback((messageKey) => {
    const active = activeRef.current;
    if (!active || active.messageKey !== messageKey) return;
    if (active.audio) {
      active.audio.pause();
      active.audio.currentTime = 0;
    }
    setState((value) => ({ ...value, status: 'idle', currentTime: 0 }));
  }, []);

  const seek = useCallback((messageKey, nextTime) => {
    const active = activeRef.current;
    if (!active?.audio || active.messageKey !== messageKey) return;
    active.audio.currentTime = Number(nextTime) || 0;
    setState((value) => ({ ...value, currentTime: active.audio.currentTime }));
  }, []);

  return { state: state.scopeKey === scopeKey ? state : EMPTY_STATE, toggle, stop, seek, reset };
}

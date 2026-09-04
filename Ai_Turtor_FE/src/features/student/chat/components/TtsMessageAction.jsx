import { LoaderCircle, Pause, Play, Square, Volume2 } from 'lucide-react';

const formatTime = (seconds) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
};

export default function TtsMessageAction({
  messageKey,
  speech,
  onToggle,
  onStop,
  onSeek,
}) {
  const isCurrent = speech.messageKey === messageKey;
  const status = isCurrent ? speech.status : 'idle';
  const loading = status === 'loading';
  const playing = status === 'playing';
  const paused = status === 'paused';
  const label = loading ? 'Đang tạo giọng...' : playing ? 'Tạm dừng' : paused ? 'Tiếp tục' : 'Đọc';
  const Icon = loading ? LoaderCircle : playing ? Pause : paused ? Play : Volume2;

  return (
    <div className="tts-message-control">
      <div className="tts-message-actions" aria-live="polite">
        <button
          type="button"
          className="tts-message-button"
          onClick={onToggle}
          disabled={loading}
          aria-label={`${label} câu trả lời của AI Tutor`}
          aria-pressed={playing}
        >
          <Icon size={15} className={loading ? 'tts-spin' : ''} aria-hidden="true" />
          <span>{label}</span>
        </button>
        {isCurrent && speech.hasAudio && (playing || paused) && (
          <button type="button" className="tts-message-stop" onClick={onStop} aria-label="Dừng đọc câu trả lời">
            <Square size={14} aria-hidden="true" /> Dừng
          </button>
        )}
      </div>

      {isCurrent && speech.hasAudio && (playing || paused) && (
        <div className="tts-mini-player" aria-label="Tiến trình giọng đọc AI Tutor">
          <span>{formatTime(speech.currentTime)}</span>
          <input
            type="range"
            min="0"
            max={Math.max(speech.duration, 0.1)}
            step="0.1"
            value={Math.min(speech.currentTime, Math.max(speech.duration, 0.1))}
            onChange={(event) => onSeek(event.target.value)}
            aria-label="Vị trí phát giọng đọc"
            aria-valuemin="0"
            aria-valuemax={Math.round(speech.duration || 0)}
            aria-valuenow={Math.round(speech.currentTime || 0)}
          />
          <span>{formatTime(speech.duration)}</span>
        </div>
      )}

      {isCurrent && speech.error && (
        <div className="tts-message-error" role="status">{speech.error}</div>
      )}
    </div>
  );
}

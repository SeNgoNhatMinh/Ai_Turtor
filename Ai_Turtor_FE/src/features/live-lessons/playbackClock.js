export function followPlaybackSeconds(snapshot, nowMs = Date.now()) {
  if (!snapshot || !snapshot.playbackActive) return 0;
  const base = Math.max(0, Number(snapshot.positionSeconds) || 0);
  if (snapshot.paused) return base;
  const capturedAt = Number(snapshot.capturedAtMs) || nowMs;
  return Math.max(0, base + (nowMs - capturedAt) / 1000);
}

export function formatClock(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function playbackSnapshotFromLesson(lesson, capturedAtMs = Date.now()) {
  return {
    playbackActive: Boolean(lesson?.playbackActive),
    paused: Boolean(lesson?.playbackPaused),
    positionSeconds: Number(lesson?.playbackElapsedSeconds) || 0,
    capturedAtMs,
  };
}

export function mergePlaybackSnapshot(previous, nextLesson) {
  const next = playbackSnapshotFromLesson(nextLesson);
  if (!previous || !next.playbackActive) return next;
  const predicted = followPlaybackSeconds(previous);
  const pauseChanged = Boolean(previous.paused) !== Boolean(next.paused);
  const jumped = Math.abs(predicted - next.positionSeconds) > 2.5;
  if (!pauseChanged && !jumped) return previous;
  return next;
}

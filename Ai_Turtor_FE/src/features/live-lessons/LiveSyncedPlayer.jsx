import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { youtubeVideoId } from '../../utils/youtubeVideo';
import { followPlaybackSeconds, formatClock } from './playbackClock';
import { loadYoutubeIframeApi } from './loadYoutubeIframeApi';

const DRIFT_SECONDS = 2.5;
const SEEK_COOLDOWN_MS = 2500;
const HEARTBEAT_MS = 4000;

function isPausedState(state) {
  return state === 2 || state === 5 || state === 0;
}

export default function LiveSyncedPlayer({
  lesson,
  snapshot,
  isTeacher,
  onControl,
}) {
  const wrapperRef = useRef(null);
  const playerRef = useRef(null);
  const seekingRef = useRef(false);
  const snapshotRef = useRef(snapshot);
  const onControlRef = useRef(onControl);
  const lastSeekAtRef = useRef(0);
  const lastBeatAtRef = useRef(0);
  const [duration, setDuration] = useState(0);
  const [localSeconds, setLocalSeconds] = useState(snapshot?.positionSeconds || 0);
  const videoId = youtubeVideoId(lesson?.youtubeUrl || lesson?.youtubeVideoId || lesson?.embedUrl);
  const playbackActive = Boolean(lesson?.playbackActive && videoId);

  snapshotRef.current = snapshot;
  onControlRef.current = onControl;

  useEffect(() => {
    if (!playbackActive || !wrapperRef.current) return undefined;
    let cancelled = false;
    const host = document.createElement('div');
    host.className = 'live-yt-host-inner';
    wrapperRef.current.replaceChildren(host);

    const readTime = (player) => {
      try {
        return player.getCurrentTime();
      } catch {
        return followPlaybackSeconds(snapshotRef.current);
      }
    };

    const applyFollow = (player = playerRef.current) => {
      if (!player || typeof player.seekTo !== 'function') return;
      const paused = Boolean(snapshotRef.current?.paused);
      const expected = followPlaybackSeconds(snapshotRef.current);
      const current = readTime(player);
      const state = player.getPlayerState?.();
      const drifted = Math.abs(current - expected) > DRIFT_SECONDS
        && Date.now() - lastSeekAtRef.current > SEEK_COOLDOWN_MS;
      if (paused) {
        if (drifted) {
          lastSeekAtRef.current = Date.now();
          player.seekTo(expected, true);
        }
        if (!isPausedState(state)) player.pauseVideo();
        return;
      }
      if (drifted) {
        lastSeekAtRef.current = Date.now();
        player.seekTo(expected, true);
      }
      if (state !== 1 && state !== 3) player.playVideo();
    };

    loadYoutubeIframeApi()
      .then((YT) => {
        if (cancelled || !host.isConnected) return;
        const start = Math.max(0, Math.floor(followPlaybackSeconds(snapshotRef.current)));
        const player = new YT.Player(host, {
          videoId,
          playerVars: {
            autoplay: snapshotRef.current?.paused ? 0 : 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            playsinline: 1,
            origin: window.location.origin,
            start,
          },
          events: {
            onReady: (event) => {
              setDuration(event.target.getDuration?.() || 0);
              applyFollow(event.target);
            },
            onStateChange: (event) => {
              if (cancelled) return;
              const paused = Boolean(snapshotRef.current?.paused);
              if (paused && (event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.BUFFERING)) {
                event.target.pauseVideo();
                return;
              }
              if (!isTeacher || seekingRef.current) return;
              if (event.data === YT.PlayerState.ENDED) {
                onControlRef.current?.({
                  paused: true,
                  positionSeconds: event.target.getCurrentTime?.() || 0,
                });
              }
            },
          },
        });
        playerRef.current = player;
      })
      .catch(() => {});

    const syncTimer = window.setInterval(() => {
      if (cancelled) return;
      const player = playerRef.current;
      if (!player) return;
      applyFollow(player);
      if (isTeacher && !seekingRef.current) {
        const paused = Boolean(snapshotRef.current?.paused);
        const current = paused
          ? followPlaybackSeconds(snapshotRef.current)
          : readTime(player);
        setLocalSeconds(current);
        if (Date.now() - lastBeatAtRef.current > HEARTBEAT_MS) {
          lastBeatAtRef.current = Date.now();
          onControlRef.current?.({
            paused,
            positionSeconds: current,
          });
        }
      } else if (!seekingRef.current) {
        setLocalSeconds(followPlaybackSeconds(snapshotRef.current));
      }
      try {
        const dur = player.getDuration?.() || 0;
        if (dur) setDuration((prev) => (prev === dur ? prev : dur));
      } catch {
        // Player was destroyed.
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearInterval(syncTimer);
      const player = playerRef.current;
      playerRef.current = null;
      try {
        player?.stopVideo?.();
        player?.destroy?.();
      } catch {
        // Ignore YouTube destroy errors on unmount.
      }
      wrapperRef.current?.replaceChildren();
    };
  }, [playbackActive, videoId, isTeacher]);

  if (!playbackActive) {
    return null;
  }

  const paused = Boolean(snapshot?.paused);
  const max = Math.max(duration || 0, Number.isFinite(localSeconds) ? localSeconds : 0, 1);
  const sliderValue = Math.min(Number.isFinite(localSeconds) ? localSeconds : 0, max);

  const readPlayerSeconds = () => {
    try {
      return playerRef.current?.getCurrentTime?.() ?? followPlaybackSeconds(snapshot);
    } catch {
      return followPlaybackSeconds(snapshot);
    }
  };

  const commit = (nextPaused, seconds) => {
    lastBeatAtRef.current = Date.now();
    const player = playerRef.current;
    if (player) {
      if (nextPaused) player.pauseVideo?.();
      else player.playVideo?.();
    }
    setLocalSeconds(Math.max(0, Number(seconds) || 0));
    onControlRef.current?.({
      paused: nextPaused,
      positionSeconds: Math.max(0, Number(seconds) || 0),
    });
  };

  return (
    <>
      <div className="live-yt-host" ref={wrapperRef} />
      <div className="live-player-lock" aria-hidden="true" />
      {isTeacher && (
        <div className="live-player-controls">
          <button
            type="button"
            className="live-btn"
            onClick={() => commit(!paused, readPlayerSeconds())}
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
            {paused ? 'Phát' : 'Tạm dừng'}
          </button>
          <input
            type="range"
            min="0"
            max={max}
            step="1"
            value={sliderValue}
            onMouseDown={() => { seekingRef.current = true; }}
            onTouchStart={() => { seekingRef.current = true; }}
            onChange={(event) => setLocalSeconds(Number(event.target.value))}
            onMouseUp={(event) => {
              seekingRef.current = false;
              const seconds = Number(event.target.value);
              playerRef.current?.seekTo?.(seconds, true);
              commit(paused, seconds);
            }}
            onTouchEnd={(event) => {
              seekingRef.current = false;
              const seconds = Number(event.target.value);
              playerRef.current?.seekTo?.(seconds, true);
              commit(paused, seconds);
            }}
          />
          <span>{formatClock(localSeconds)} / {formatClock(duration)}</span>
        </div>
      )}
    </>
  );
}

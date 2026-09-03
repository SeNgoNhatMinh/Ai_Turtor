import { describe, expect, it } from 'vitest';
import {
  followPlaybackSeconds,
  formatClock,
  mergePlaybackSnapshot,
  playbackSnapshotFromLesson,
} from '../../src/features/live-lessons/playbackClock';

describe('playbackClock', () => {
  it('keeps a paused snapshot still and advances a playing snapshot', () => {
    expect(followPlaybackSeconds({
      playbackActive: true,
      paused: true,
      positionSeconds: 40,
      capturedAtMs: 1_000,
    }, 5_000)).toBe(40);
    expect(followPlaybackSeconds({
      playbackActive: true,
      paused: false,
      positionSeconds: 40,
      capturedAtMs: 1_000,
    }, 3_000)).toBe(42);
  });

  it('does not rebuild the student clock on a small poll drift', () => {
    const now = Date.now();
    const previous = {
      playbackActive: true,
      paused: false,
      positionSeconds: 20,
      capturedAtMs: now - 2000,
    };
    const merged = mergePlaybackSnapshot(previous, {
      playbackActive: true,
      playbackPaused: false,
      playbackElapsedSeconds: 22,
    });
    expect(merged).toBe(previous);
  });

  it('rebuilds the clock when the teacher pauses or jumps', () => {
    const previous = playbackSnapshotFromLesson({
      playbackActive: true,
      playbackPaused: false,
      playbackElapsedSeconds: 20,
      playbackClockEpochMs: 1_000,
    }, 1_000);
    const paused = mergePlaybackSnapshot(previous, {
      playbackActive: true,
      playbackPaused: true,
      playbackElapsedSeconds: 20,
      playbackClockEpochMs: Date.now(),
    });
    expect(paused.paused).toBe(true);
    expect(formatClock(75)).toBe('1:15');
  });

  it('applies a teacher pause even if the poll clock is slightly behind', () => {
    const previous = {
      playbackActive: true,
      paused: false,
      positionSeconds: 40,
      capturedAtMs: 5_000,
      clockAtMs: 5_000,
    };
    const merged = mergePlaybackSnapshot(previous, {
      playbackActive: true,
      playbackPaused: true,
      playbackElapsedSeconds: 40,
      playbackClockEpochMs: 4_000,
    });
    expect(merged.paused).toBe(true);
  });

  it('does not let a stale poll unpause a newer pause', () => {
    const previous = {
      playbackActive: true,
      paused: true,
      positionSeconds: 40,
      capturedAtMs: 5_000,
      clockAtMs: 5_000,
    };
    const merged = mergePlaybackSnapshot(previous, {
      playbackActive: true,
      playbackPaused: false,
      playbackElapsedSeconds: 42,
      playbackClockAt: new Date(1_000).toISOString(),
    });
    expect(merged).toBe(previous);
  });
});

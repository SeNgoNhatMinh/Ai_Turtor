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
    }, 1_000);
    const paused = mergePlaybackSnapshot(previous, {
      playbackActive: true,
      playbackPaused: true,
      playbackElapsedSeconds: 20,
    });
    expect(paused.paused).toBe(true);
    expect(formatClock(75)).toBe('1:15');
  });
});

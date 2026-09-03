import { describe, expect, it } from 'vitest';
import { isStartingWithinHours } from '../../src/features/live-lessons/liveLessonUtils';

describe('liveLessonUtils', () => {
  it('shows scheduled lessons that start within 24 hours', () => {
    expect(isStartingWithinHours({
      status: 'SCHEDULED',
      playbackActive: false,
      minutesUntilStart: 90,
    })).toBe(true);
    expect(isStartingWithinHours({
      status: 'SCHEDULED',
      playbackActive: false,
      minutesUntilStart: 9,
    })).toBe(true);
    expect(isStartingWithinHours({
      status: 'SCHEDULED',
      playbackActive: false,
      minutesUntilStart: 25 * 60,
    })).toBe(false);
  });

  it('hides ended, live, or already-started lessons from the 24h banner', () => {
    expect(isStartingWithinHours({ status: 'ENDED', minutesUntilStart: 30 })).toBe(false);
    expect(isStartingWithinHours({
      status: 'SCHEDULED',
      playbackActive: true,
      minutesUntilStart: 5,
    })).toBe(false);
    expect(isStartingWithinHours({
      status: 'SCHEDULED',
      playbackActive: false,
      minutesUntilStart: 0,
    })).toBe(false);
  });
});

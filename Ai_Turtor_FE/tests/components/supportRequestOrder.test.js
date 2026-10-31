import { describe, expect, it } from 'vitest';
import { sortSupportRequestsNewestFirst } from '../../src/utils/supportRequestOrder';

describe('sortSupportRequestsNewestFirst', () => {
  it('puts the newest created request first even when an older request was updated later', () => {
    const sorted = sortSupportRequestsNewestFirst([
      { id: 'old', createdAt: '2026-01-01T00:00:00', updatedAt: '2026-10-02T00:00:00' },
      { id: 'new', createdAt: '2026-10-01T00:00:00', updatedAt: '2026-10-01T00:00:00' },
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['new', 'old']);
  });

  it('uses updatedAt when createdAt is missing', () => {
    const sorted = sortSupportRequestsNewestFirst([
      { id: 'older', updatedAt: '2026-03-01T00:00:00' },
      { id: 'newer', updatedAt: '2026-04-01T00:00:00' },
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['newer', 'older']);
  });
});

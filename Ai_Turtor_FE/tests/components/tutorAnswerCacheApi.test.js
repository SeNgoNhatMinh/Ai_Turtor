import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/apiClient', () => ({
  API_BASE_URL: '/api',
  request: vi.fn(),
}));

import { request } from '../../src/services/apiClient';
import {
  normalizeAnswerCacheEntry,
  normalizeAnswerCacheList,
  tutorAnswerCacheApi,
} from '../../src/services/tutorAnswerCacheApi';

describe('tutorAnswerCacheApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    request.mockResolvedValue({});
  });

  it('normalizes cache entries without inventing review status', () => {
    expect(normalizeAnswerCacheList({
      count: 1,
      entries: [{
        id: 'cache-1',
        courseId: 'CS101',
        reviewStatus: 'SENIOR_APPROVED',
        confidence: 0.82,
        sources: ['doc-a'],
      }],
    })).toEqual([expect.objectContaining({
      id: 'cache-1',
      courseId: 'CS101',
      reviewStatus: 'SENIOR_APPROVED',
      confidence: 0.82,
      sources: ['doc-a'],
    })]);

    expect(normalizeAnswerCacheEntry({ id: 'cache-2' }).reviewStatus).toBe('ACTIVE');
  });

  it('uses the exact backend methods and paths for cache mutations', async () => {
    const payload = {
      seniorReviewerId: 'senior-1',
      seniorReviewerName: 'Senior A',
      reviewerRole: 'SENIOR_MENTOR',
    };

    await tutorAnswerCacheApi.list({ courseId: 'CS101', mode: 'RAG' });
    expect(request).toHaveBeenLastCalledWith(
      '/api/tutor/answer-cache?courseId=CS101&mode=RAG',
      expect.objectContaining({ skipUnauthorizedRedirect: true }),
    );

    await tutorAnswerCacheApi.getStats('CS101');
    expect(request).toHaveBeenLastCalledWith(
      '/api/tutor/answer-cache/stats?courseId=CS101',
      expect.objectContaining({ skipUnauthorizedRedirect: true }),
    );

    await tutorAnswerCacheApi.approve('cache 1', payload);
    expect(request).toHaveBeenLastCalledWith('/api/tutor/answer-cache/cache%201/approve', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(payload),
    }));

    await tutorAnswerCacheApi.correct('cache-1', { ...payload, correctedAnswer: 'fixed' });
    expect(request).toHaveBeenLastCalledWith('/api/tutor/answer-cache/cache-1', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ ...payload, correctedAnswer: 'fixed' }),
    }));

    await tutorAnswerCacheApi.disable('cache-1', payload);
    expect(request).toHaveBeenLastCalledWith('/api/tutor/answer-cache/cache-1/disable', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(payload),
    }));

    await tutorAnswerCacheApi.delete('cache-1', payload);
    expect(request).toHaveBeenLastCalledWith('/api/tutor/answer-cache/cache-1', expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify(payload),
    }));
  });
});

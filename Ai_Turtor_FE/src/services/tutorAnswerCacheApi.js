import { API_BASE_URL, request } from './apiClient';
import { encodePath } from '../config/env';

const preserveSession = { skipUnauthorizedRedirect: true };
const optionalNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function normalizeCacheHit(hit = {}) {
  return {
    ...hit,
    id: String(hit.id || hit.hitId || '').trim(),
    matchedCacheId: String(hit.matchedCacheId || hit.cacheId || '').trim(),
    hitType: String(hit.hitType || hit.cacheHitType || hit.type || '').trim().toUpperCase(),
    similarity: optionalNumber(hit.similarity ?? hit.similarityScore),
    cacheLookupMs: optionalNumber(hit.cacheLookupMs ?? hit.lookupMs),
    backendProcessingMs: optionalNumber(hit.backendProcessingMs ?? hit.processingMs),
    createdAt: hit.createdAt || hit.hitAt || hit.timestamp || null,
  };
}

function normalizeAnswerCacheStats(stats = {}) {
  const latest = stats.latestCacheHit || stats.latestHit || {};
  const recent = stats.recentHitLogs || stats.recentHits || stats.hitLogs || [];
  return {
    ...stats,
    total: Number(stats.total) || 0,
    totalReuseCount: Number(stats.totalReuseCount) || 0,
    latestCacheHitType: String(
      stats.latestCacheHitType || stats.latestHitType || latest.hitType || latest.cacheHitType || '',
    ).trim().toUpperCase(),
    latestSimilarity: optionalNumber(stats.latestSimilarity ?? latest.similarity ?? latest.similarityScore),
    latestCacheLookupMs: optionalNumber(stats.latestCacheLookupMs ?? latest.cacheLookupMs ?? latest.lookupMs),
    latestBackendProcessingMs: optionalNumber(
      stats.latestBackendProcessingMs ?? latest.backendProcessingMs ?? latest.processingMs,
    ),
    latestCacheHitAt: stats.latestCacheHitAt || stats.latestHitAt || latest.createdAt || latest.hitAt || null,
    recentHits: (Array.isArray(recent) ? recent : []).map(normalizeCacheHit),
  };
}

export function normalizeAnswerCacheEntry(entry = {}) {
  const id = String(entry.id || '').trim();
  return {
    ...entry,
    id,
    courseId: String(entry.courseId || '').trim(),
    classId: String(entry.classId || '').trim(),
    mode: String(entry.mode || 'RAG').trim().toUpperCase(),
    question: String(entry.question || '').trim(),
    answer: String(entry.answer || '').trim(),
    originalAnswer: String(entry.originalAnswer || '').trim(),
    reviewStatus: String(entry.reviewStatus || 'ACTIVE').trim().toUpperCase(),
    groundingType: String(entry.groundingType || '').trim(),
    confidence: Number(entry.confidence) || 0,
    sources: Array.isArray(entry.sources) ? entry.sources : [],
    semanticReady: entry.semanticReady === true,
    reuseCount: Number(entry.reuseCount) || 0,
    lastReusedAt: entry.lastReusedAt || null,
    linkedReviewId: String(entry.linkedReviewId || '').trim(),
    seniorReviewerId: String(entry.seniorReviewerId || '').trim(),
    seniorReviewerName: String(entry.seniorReviewerName || '').trim(),
    seniorReviewNotes: String(entry.seniorReviewNotes || '').trim(),
    seniorReviewedAt: entry.seniorReviewedAt || null,
    createdAt: entry.createdAt || null,
    expiresAt: entry.expiresAt || null,
  };
}

export function normalizeAnswerCacheList(data) {
  const entries = Array.isArray(data) ? data : data?.entries;
  return (Array.isArray(entries) ? entries : [])
    .map(normalizeAnswerCacheEntry)
    .filter((entry) => entry.id);
}

const jsonOptions = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const tutorAnswerCacheApi = {
  async list(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        params.set(key, String(value).trim());
      }
    });
    const query = params.toString();
    const data = await request(
      `${API_BASE_URL}/tutor/answer-cache${query ? `?${query}` : ''}`,
      preserveSession,
    );
    return normalizeAnswerCacheList(data);
  },
  async getStats(courseId) {
    const params = new URLSearchParams({ courseId: String(courseId || '').trim() });
    const data = await request(`${API_BASE_URL}/tutor/answer-cache/stats?${params}`, preserveSession);
    return normalizeAnswerCacheStats(data);
  },
  async getDiagnostics(courseId) {
    const params = new URLSearchParams({ courseId: String(courseId || '').trim() });
    return request(`${API_BASE_URL}/tutor/answer-cache/diagnostics?${params}`, preserveSession);
  },
  async getRecentHits(courseId, limit = 50) {
    const params = new URLSearchParams({
      courseId: String(courseId || '').trim(),
      limit: String(limit),
    });
    const data = await request(
      `${API_BASE_URL}/tutor/answer-cache/hits/recent?${params}`,
      preserveSession,
    );
    const hits = Array.isArray(data) ? data : data?.hits;
    return (Array.isArray(hits) ? hits : []).map(normalizeCacheHit);
  },
  async getEntry(cacheId) {
    const data = await request(
      `${API_BASE_URL}/tutor/answer-cache/${encodePath(cacheId)}`,
      preserveSession,
    );
    return normalizeAnswerCacheEntry(data);
  },
  async approve(cacheId, payload) {
    return request(`${API_BASE_URL}/tutor/answer-cache/${encodePath(cacheId)}/approve`, {
      ...jsonOptions('POST', payload),
      ...preserveSession,
    });
  },
  async correct(cacheId, payload) {
    return request(`${API_BASE_URL}/tutor/answer-cache/${encodePath(cacheId)}`, {
      ...jsonOptions('PATCH', payload),
      ...preserveSession,
    });
  },
  async disable(cacheId, payload) {
    return request(`${API_BASE_URL}/tutor/answer-cache/${encodePath(cacheId)}/disable`, {
      ...jsonOptions('POST', payload),
      ...preserveSession,
    });
  },
  async delete(cacheId, payload) {
    return request(`${API_BASE_URL}/tutor/answer-cache/${encodePath(cacheId)}`, {
      ...jsonOptions('DELETE', payload),
      ...preserveSession,
    });
  },
};

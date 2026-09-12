import { appQueryClient } from '../app/queryClient';

const DEFAULT_STALE_TIME_MS = 15_000;

const normalizeQueryKey = (queryKey) => (
  Array.isArray(queryKey) ? queryKey : [String(queryKey || '')]
);

/**
 * Shared imperative entry point for service methods that are also called outside
 * React components. TanStack Query still owns request deduplication, freshness,
 * garbage collection and invalidation.
 */
export function fetchServerQuery(queryKey, queryFn, options = {}) {
  const normalizedKey = normalizeQueryKey(queryKey);
  const { staleTime = DEFAULT_STALE_TIME_MS, force = false } = options;

  if (force) {
    appQueryClient.invalidateQueries({
      queryKey: normalizedKey,
      exact: true,
      refetchType: 'none',
    });
  }

  return appQueryClient.fetchQuery({
    queryKey: normalizedKey,
    queryFn,
    staleTime: force ? 0 : staleTime,
  });
}

export function invalidateServerQueries(queryKey = []) {
  return appQueryClient.invalidateQueries({
    queryKey: normalizeQueryKey(queryKey).filter(Boolean),
  });
}

export function clearServerQueryCache() {
  appQueryClient.clear();
}

export function getServerQueryCacheSize() {
  return appQueryClient.getQueryCache().getAll().length;
}

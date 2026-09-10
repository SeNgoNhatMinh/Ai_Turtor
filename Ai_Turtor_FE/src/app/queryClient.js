import { QueryClient } from '@tanstack/react-query';

const RETRYABLE_QUERY_STATUSES = new Set([0, 408, 425, 502, 503, 504]);

const shouldRetryQuery = (failureCount, error) => {
  const status = Number(error?.status || 0);
  return failureCount < 2 && RETRYABLE_QUERY_STATUSES.has(status);
};

const retryDelay = (attemptIndex) => {
  const backoffMs = Math.min(750 * (2 ** attemptIndex), 8000);
  return backoffMs + Math.floor(Math.random() * 500);
};

export const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: shouldRetryQuery,
      retryDelay,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});

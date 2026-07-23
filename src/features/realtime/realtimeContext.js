import { createContext, useContext, useEffect, useRef } from 'react';

export const RealtimeEventsContext = createContext({
  connectionState: 'DISCONNECTED',
  connectionVersion: 0,
  subscribe: () => () => {},
});

export function useRealtimeConnectionState() {
  return useContext(RealtimeEventsContext).connectionState;
}

export function useRealtimeReconnect(handler) {
  const { connectionVersion } = useContext(RealtimeEventsContext);
  const handlerRef = useRef(handler);
  const seenVersionRef = useRef(connectionVersion);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (connectionVersion > seenVersionRef.current) {
      handlerRef.current?.();
    }
    seenVersionRef.current = connectionVersion;
  }, [connectionVersion]);
}

export function useRealtimeEvent(types, handler) {
  const { subscribe } = useContext(RealtimeEventsContext);
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  const typeKey = (Array.isArray(types) ? types : [types])
    .filter(Boolean)
    .map((type) => String(type).toUpperCase())
    .sort()
    .join('|');

  useEffect(() => {
    if (!typeKey) return undefined;
    const acceptedTypes = new Set(typeKey.split('|'));
    return subscribe((event) => {
      if (acceptedTypes.has(event.type)) handlerRef.current?.(event);
    });
  }, [subscribe, typeKey]);
}

export function useCanonicalPolling(handler, {
  enabled = true,
  intervalMs = 30000,
  refreshOnFocus = true,
} = {}) {
  const handlerRef = useRef(handler);
  const inFlightRef = useRef(false);
  const lastRunAtRef = useRef(0);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const run = async () => {
      if (
        inFlightRef.current
        || document.visibilityState === 'hidden'
        || (typeof navigator !== 'undefined' && navigator.onLine === false)
        || Date.now() - lastRunAtRef.current < 1000
      ) {
        return;
      }
      inFlightRef.current = true;
      lastRunAtRef.current = Date.now();
      try {
        await handlerRef.current?.();
      } catch {
        // Feature-level loaders own their user-facing error state.
      } finally {
        inFlightRef.current = false;
      }
    };

    const intervalId = window.setInterval(run, Math.max(5000, intervalMs));
    const onFocus = () => refreshOnFocus && run();
    const onVisibilityChange = () => {
      if (refreshOnFocus && document.visibilityState === 'visible') run();
    };
    if (refreshOnFocus) {
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, intervalMs, refreshOnFocus]);
}

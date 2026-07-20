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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { env } from '../../config/env';
import { getAuthToken } from '../auth/services/tokenStorage';
import { RealtimeEventsContext } from './realtimeContext';
import {
  buildRealtimeSocketUrl,
  getRealtimeEventDedupeKey,
  normalizeRealtimeEvent,
} from './realtimeEvents';

const PING_INTERVAL_MS = 25000;
const MAX_RECONNECT_DELAY_MS = 30000;
const EVENT_DEDUPE_WINDOW_MS = 1500;

export default function RealtimeEventsProvider({ enabled, sessionKey = '', children }) {
  const subscribersRef = useRef(new Set());
  const [connectionState, setConnectionState] = useState('DISCONNECTED');

  const subscribe = useCallback((handler) => {
    subscribersRef.current.add(handler);
    return () => subscribersRef.current.delete(handler);
  }, []);

  useEffect(() => {
    if (!enabled || typeof WebSocket === 'undefined') return undefined;
    const token = getAuthToken();
    if (!token) return undefined;

    let disposed = false;
    let socket = null;
    let pingTimer = null;
    let reconnectTimer = null;
    let reconnectAttempt = 0;
    const recentEventKeys = new Map();

    const clearTimers = () => {
      window.clearInterval(pingTimer);
      window.clearTimeout(reconnectTimer);
      pingTimer = null;
      reconnectTimer = null;
    };

    const scheduleReconnect = (connect) => {
      if (disposed || reconnectTimer) return;
      const baseDelay = Math.min(1000 * (2 ** reconnectAttempt), MAX_RECONNECT_DELAY_MS);
      const jitter = Math.floor(Math.random() * 300);
      reconnectAttempt += 1;
      setConnectionState('RECONNECTING');
      reconnectTimer = window.setTimeout(connect, baseDelay + jitter);
    };

    const connect = () => {
      if (disposed) return;
      reconnectTimer = null;
      setConnectionState('CONNECTING');
      const url = buildRealtimeSocketUrl({
        apiBaseUrl: env.apiBaseUrl,
        explicitUrl: env.realtimeSocketUrl,
        token,
      });
      try {
        socket = new WebSocket(url);
      } catch {
        scheduleReconnect(connect);
        return;
      }

      socket.onopen = () => {
        reconnectAttempt = 0;
        setConnectionState('CONNECTED');
        window.clearInterval(pingTimer);
        pingTimer = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'PING' }));
          }
        }, PING_INTERVAL_MS);
      };

      socket.onmessage = ({ data }) => {
        const event = normalizeRealtimeEvent(data);
        if (!event || event.type === 'PONG') return;
        const dedupeKey = getRealtimeEventDedupeKey(event);
        const receivedAt = Date.now();
        if (dedupeKey && receivedAt - (recentEventKeys.get(dedupeKey) || 0) < EVENT_DEDUPE_WINDOW_MS) {
          return;
        }
        if (dedupeKey) {
          recentEventKeys.set(dedupeKey, receivedAt);
          if (recentEventKeys.size > 200) {
            recentEventKeys.forEach((timestamp, key) => {
              if (receivedAt - timestamp > EVENT_DEDUPE_WINDOW_MS) recentEventKeys.delete(key);
            });
          }
        }
        subscribersRef.current.forEach((handler) => {
          try {
            handler(event);
          } catch (error) {
            console.warn('Realtime event subscriber failed:', error);
          }
        });
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        window.clearInterval(pingTimer);
        pingTimer = null;
        socket = null;
        scheduleReconnect(connect);
      };
    };

    connect();
    return () => {
      disposed = true;
      clearTimers();
      recentEventKeys.clear();
      setConnectionState('DISCONNECTED');
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [enabled, sessionKey]);

  const value = useMemo(() => ({ connectionState, subscribe }), [connectionState, subscribe]);
  return (
    <RealtimeEventsContext.Provider value={value}>
      {children}
    </RealtimeEventsContext.Provider>
  );
}

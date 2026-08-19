import { useCallback, useEffect, useRef } from 'react';
import {
  useCanonicalPolling,
  useRealtimeConnectionState,
  useRealtimeEvent,
  useRealtimeReconnect,
} from '../../realtime/realtimeContext';
import { eventMatchesCourse, REALTIME_EVENT_TYPES } from '../../realtime/realtimeEvents';

const REALTIME_REFRESH_DELAY_MS = 350;

export function useExpertTrainingRealtimeRefresh({
  courseId,
  resourceMode,
  mutationActive,
  refreshAll,
  refreshLive,
  loadChapters,
  loadContributions,
  loadTasks,
}) {
  const connectionState = useRealtimeConnectionState();
  const tutorTimerRef = useRef(null);
  const materialTimerRef = useRef(null);

  useRealtimeReconnect(refreshLive || refreshAll);
  useCanonicalPolling(refreshLive || refreshAll, {
    enabled: Boolean(courseId && !mutationActive),
    intervalMs: 30000,
    refreshOnFocus: true,
  });

  const scheduleTutorRefresh = useCallback((event) => {
    if (!eventMatchesCourse(event, courseId)) return;
    window.clearTimeout(tutorTimerRef.current);
    tutorTimerRef.current = window.setTimeout(() => {
      if (REALTIME_EVENT_TYPES.expertTasks.includes(event.type)) loadTasks();
      if (REALTIME_EVENT_TYPES.expertContributions.includes(event.type)) {
        loadTasks();
        loadContributions();
      }
    }, REALTIME_REFRESH_DELAY_MS);
  }, [courseId, loadContributions, loadTasks]);

  const scheduleMaterialRefresh = useCallback((event) => {
    if (resourceMode === 'teacher' || !eventMatchesCourse(event, courseId)) return;
    window.clearTimeout(materialTimerRef.current);
    materialTimerRef.current = window.setTimeout(() => {
      loadChapters();
    }, REALTIME_REFRESH_DELAY_MS);
  }, [courseId, loadChapters, resourceMode]);

  useRealtimeEvent(REALTIME_EVENT_TYPES.tutorV2, scheduleTutorRefresh);
  useRealtimeEvent(REALTIME_EVENT_TYPES.material, scheduleMaterialRefresh);

  useEffect(() => () => {
    window.clearTimeout(tutorTimerRef.current);
    window.clearTimeout(materialTimerRef.current);
  }, []);

  return connectionState;
}

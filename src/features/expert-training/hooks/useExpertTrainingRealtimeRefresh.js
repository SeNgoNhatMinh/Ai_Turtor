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
  loadChapters,
  loadContributions,
  loadEvaluation,
  loadGaps,
  loadTasks,
}) {
  const connectionState = useRealtimeConnectionState();
  const tutorTimerRef = useRef(null);
  const materialTimerRef = useRef(null);

  useRealtimeReconnect(refreshAll);
  useCanonicalPolling(refreshAll, {
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
      if (REALTIME_EVENT_TYPES.expertEvaluation.includes(event.type)) loadEvaluation();
    }, REALTIME_REFRESH_DELAY_MS);
  }, [courseId, loadContributions, loadEvaluation, loadTasks]);

  const scheduleMaterialRefresh = useCallback((event) => {
    if (resourceMode === 'teacher' || !eventMatchesCourse(event, courseId)) return;
    window.clearTimeout(materialTimerRef.current);
    materialTimerRef.current = window.setTimeout(() => {
      loadChapters();
      loadGaps();
    }, REALTIME_REFRESH_DELAY_MS);
  }, [courseId, loadChapters, loadGaps, resourceMode]);

  useRealtimeEvent(REALTIME_EVENT_TYPES.tutorV2, scheduleTutorRefresh);
  useRealtimeEvent(REALTIME_EVENT_TYPES.material, scheduleMaterialRefresh);

  useEffect(() => () => {
    window.clearTimeout(tutorTimerRef.current);
    window.clearTimeout(materialTimerRef.current);
  }, []);

  return connectionState;
}

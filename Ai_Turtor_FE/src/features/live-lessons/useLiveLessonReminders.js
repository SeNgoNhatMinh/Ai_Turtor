import { useCallback, useEffect } from 'react';
import { liveLessonApi } from '../../services/liveLessonApi';
import { useCanonicalPolling, useRealtimeEvent, useRealtimeReconnect } from '../realtime/realtimeContext';
import { REALTIME_EVENT_TYPES } from '../realtime/realtimeEvents';
import {
  asLessonList,
  claimLessonNudge,
  formatLessonTime,
  notifyUpcomingLesson,
  showLiveLessonNotification,
} from './liveLessonUtils';

function scheduledToast(event) {
  const topic = event?.data?.topic || 'Buổi live';
  const when = event?.data?.startsAt ? formatLessonTime(event.data.startsAt) : '';
  const minutes = Number(event?.data?.minutesUntilStart);
  if (Number.isFinite(minutes) && minutes <= 10) {
    return minutes > 0
      ? `Còn ${minutes} phút nữa tới buổi live: ${topic}`
      : `Đã tới giờ live: ${topic}. Vào phòng chờ giảng viên.`;
  }
  return `Giảng viên vừa tạo buổi live: ${topic}${when ? ` · ${when}` : ''}. Bạn sẽ được nhắc trước 10 phút.`;
}

export function useLiveLessonReminders({ enabled, triggerToast }) {
  const load = useCallback(async () => {
    if (!enabled) return;
    const lessons = asLessonList(await liveLessonApi.list());
    lessons.forEach((lesson) => {
      if (lesson.playbackActive) {
        if (!claimLessonNudge('live', lesson.id)) return;
        triggerToast?.(`Giảng viên đã bắt đầu: ${lesson.topic || 'Buổi live'}`);
        showLiveLessonNotification(
          `Đang live: ${lesson.topic || 'Buổi live'}`,
          'Vào phòng Live theo lớp để xem cùng lớp.',
        );
        return;
      }
      if (lesson.upcomingSoon && notifyUpcomingLesson(lesson)) {
        triggerToast?.(
          lesson.minutesUntilStart > 0
            ? `Còn ${lesson.minutesUntilStart} phút nữa tới buổi live: ${lesson.topic}`
            : `Đã tới giờ live: ${lesson.topic}. Vào phòng chờ giảng viên.`,
        );
      }
    });
  }, [enabled, triggerToast]);

  useEffect(() => {
    if (!enabled) return undefined;
    load().catch(() => {});
    return undefined;
  }, [enabled, load]);

  useCanonicalPolling(load, { enabled: Boolean(enabled), intervalMs: 20000 });
  useRealtimeReconnect(() => {
    if (enabled) load().catch(() => {});
  });
  useRealtimeEvent(REALTIME_EVENT_TYPES.liveLesson, (event) => {
    if (!enabled) return;
    if (event.type === 'LIVE_LESSON_SCHEDULED' && claimLessonNudge('scheduled', event.entityId)) {
      const minutes = Number(event.data?.minutesUntilStart);
      if (Number.isFinite(minutes) && minutes <= 10) {
        claimLessonNudge('soon', event.entityId);
      }
      triggerToast?.(scheduledToast(event));
      showLiveLessonNotification(
        `Live lớp: ${event.data?.topic || 'Buổi live'}`,
        event.data?.startsAt ? formatLessonTime(event.data.startsAt) : 'Mở Live theo lớp để xem lịch.',
      );
    }
    if (event.type === 'LIVE_LESSON_STARTING') {
      const lesson = {
        id: event.entityId,
        topic: event.data?.topic,
        upcomingSoon: true,
        minutesUntilStart: event.data?.minutesUntilStart,
        playbackActive: false,
      };
      if (notifyUpcomingLesson(lesson)) {
        triggerToast?.(
          lesson.minutesUntilStart > 0
            ? `Còn ${lesson.minutesUntilStart} phút nữa tới buổi live: ${lesson.topic}`
            : `Đã tới giờ live: ${lesson.topic || 'Buổi live'}. Vào phòng chờ giảng viên.`,
        );
      }
    }
    if (event.type === 'LIVE_LESSON_STARTED' && claimLessonNudge('live', event.entityId)) {
      triggerToast?.(`Giảng viên đã bắt đầu: ${event.data?.topic || 'Buổi live'}`);
      showLiveLessonNotification(
        `Đang live: ${event.data?.topic || 'Buổi live'}`,
        'Vào phòng Live theo lớp để xem cùng lớp.',
      );
    }
    if (event.type === 'LIVE_LESSON_ENDED') {
      triggerToast?.(`Buổi live đã kết thúc: ${event.data?.topic || 'Buổi live'}`);
    }
    load().catch(() => {});
  });
}

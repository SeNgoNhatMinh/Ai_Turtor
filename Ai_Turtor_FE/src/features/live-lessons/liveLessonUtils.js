export const STATUS_LABEL = {
  SCHEDULED: 'Chờ giảng viên',
  LIVE: 'Đang phát',
  ENDED: 'Đã kết thúc',
};

const NUDGE_PREFIX = 'live-lesson-nudge:';

export function formatLessonTime(value) {
  if (!value) return 'Chưa đặt giờ';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

export function toDateTimeLocalValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDateTimeLocalValue(value) {
  if (!value) return '';
  return value.length === 16 ? `${value}:00` : value;
}

export function asLessonList(payload) {
  return Array.isArray(payload) ? payload : [];
}

export function waitingCopy(lesson) {
  if (!lesson) return 'Đang chờ giảng viên bắt đầu video.';
  if (lesson.playbackActive) return '';
  if (lesson.status === 'ENDED') {
    return 'Buổi đã kết thúc. Xem lại khi giảng viên gửi link YouTube trên chat lớp.';
  }
  if (lesson.upcomingSoon && lesson.minutesUntilStart > 0) {
    return `Còn khoảng ${lesson.minutesUntilStart} phút nữa tới giờ học. Vào phòng chờ, video chỉ chạy khi giảng viên bấm bắt đầu.`;
  }
  if (lesson.upcomingSoon || (lesson.minutesUntilStart != null && lesson.minutesUntilStart <= 0)) {
    return 'Đã tới giờ. Chờ giảng viên bấm bắt đầu video — bạn không tự phát được.';
  }
  return 'Phòng đã mở. Video chỉ chạy khi giảng viên bấm bắt đầu.';
}

export function isStartingWithinHours(lesson, hours = 24) {
  if (!lesson || lesson.status === 'ENDED' || lesson.playbackActive) return false;
  const minutes = Number(lesson.minutesUntilStart);
  if (Number.isFinite(minutes)) {
    return minutes > 0 && minutes <= hours * 60;
  }
  if (!lesson.startsAt) return false;
  const start = new Date(lesson.startsAt).getTime();
  if (Number.isNaN(start)) return false;
  const delta = start - Date.now();
  return delta > 0 && delta <= hours * 3600 * 1000;
}

export function notificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function enableLiveLessonNotifications() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function showLiveLessonNotification(title, body) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body });
  } catch {
    // Ignore browsers that block Notification construction without a service worker.
  }
}

export function claimLessonNudge(kind, lessonId) {
  if (!kind || !lessonId || typeof window === 'undefined') return false;
  const key = `${NUDGE_PREFIX}${kind}:${lessonId}`;
  try {
    if (window.localStorage.getItem(key)) return false;
    window.localStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

export function notifyUpcomingLesson(lesson) {
  if (!lesson?.id || !lesson.upcomingSoon || lesson.playbackActive) return false;
  if (!claimLessonNudge('soon', lesson.id)) return false;
  const title = `Sắp học: ${lesson.topic || 'Buổi live'}`;
  const body = lesson.minutesUntilStart > 0
    ? `Còn ${lesson.minutesUntilStart} phút. Vào phòng chờ, video do giảng viên phát.`
    : 'Đã tới giờ. Vào phòng và chờ giảng viên bắt đầu video.';
  showLiveLessonNotification(title, body);
  return true;
}

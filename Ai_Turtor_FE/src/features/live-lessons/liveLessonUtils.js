export const STATUS_LABEL = {
  SCHEDULED: 'Chờ giảng viên',
  LIVE: 'Đang phát',
  ENDED: 'Đã kết thúc',
};

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

const NOTIFY_KEY = 'live-lesson-notified';

function notifiedIds() {
  try {
    return JSON.parse(window.sessionStorage.getItem(NOTIFY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function rememberNotified(lessonId) {
  const ids = new Set(notifiedIds());
  ids.add(lessonId);
  window.sessionStorage.setItem(NOTIFY_KEY, JSON.stringify([...ids]));
}

export function wasNotified(lessonId) {
  return notifiedIds().includes(lessonId);
}

export async function notifyUpcomingLesson(lesson) {
  if (!lesson?.id || !lesson.upcomingSoon || lesson.playbackActive || wasNotified(lesson.id)) return;
  rememberNotified(lesson.id);
  const title = `Sắp học: ${lesson.topic || 'Buổi live'}`;
  const body = lesson.minutesUntilStart > 0
    ? `Còn ${lesson.minutesUntilStart} phút. Vào phòng chờ, video do giảng viên phát.`
    : 'Đã tới giờ. Vào phòng và chờ giảng viên bắt đầu video.';
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      return;
    }
  }
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body });
    } catch {
      // Ignore browsers that block Notification construction without a service worker.
    }
  }
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { liveLessonApi } from '../../services/liveLessonApi';
import { getUserFacingError } from '../../services/httpClient';
import {
  asLessonList,
  enableLiveLessonNotifications,
  formatLessonTime,
  isStartingWithinHours,
  notificationPermission,
  STATUS_LABEL,
} from './liveLessonUtils';
import './live-lesson.css';

export default function StudentLiveLessonsPage({
  courseId,
  classId,
  triggerToast,
}) {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);
  const [notifyState, setNotifyState] = useState(() => notificationPermission());

  useEffect(() => {
    let cancelled = false;
    const load = () => liveLessonApi.list({ courseId, classId })
      .then((payload) => {
        const next = asLessonList(payload);
        if (cancelled) return;
        setLessons(next);
      })
      .catch((error) => {
        if (!cancelled) triggerToast?.(getUserFacingError(error), 'error');
      });
    load();
    const timer = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [courseId, classId, triggerToast]);

  const liveNow = lessons.filter((lesson) => lesson.playbackActive || lesson.status === 'LIVE');
  const soon = lessons.filter((lesson) => lesson.upcomingSoon && !lesson.playbackActive);
  const comingUp = lessons.filter((lesson) => (
    isStartingWithinHours(lesson, 24) && !lesson.upcomingSoon && !lesson.playbackActive
  ));

  const enableNotify = async () => {
    const next = await enableLiveLessonNotifications();
    setNotifyState(next);
    if (next === 'granted') {
      triggerToast?.('Đã bật thông báo trình duyệt cho buổi live.');
    } else if (next === 'denied') {
      triggerToast?.('Trình duyệt đang chặn thông báo. Hãy cho phép trong cài đặt trang.');
    }
  };

  return (
    <div className="portal-section live-lesson-page">
      <PageHeader
        eyebrow="Học thêm"
        title="Live theo lớp"
        description="Giảng viên có thể tạo trước 1 ngày hoặc hơn. Bạn thấy lịch ở đây; 10 phút trước giờ học sẽ có thông báo trên app. Video chỉ chạy khi giảng viên bấm bắt đầu."
      />

      {notifyState !== 'granted' && notifyState !== 'unsupported' && (
        <section className="live-now-banner scheduled">
          <div>
            <strong>Bật thông báo trình duyệt</strong>
            <p>Để nhận nhắc khi sắp tới giờ, kể cả khi bạn đang ở trang khác trong app.</p>
          </div>
          <button type="button" className="live-btn secondary" onClick={enableNotify}>Bật thông báo</button>
        </section>
      )}

      {liveNow.map((lesson) => (
        <section key={lesson.id} className="live-now-banner live">
          <div>
            <strong>Giảng viên đang phát: {lesson.topic}</strong>
            <p>{lesson.courseId} · {lesson.classId} · {formatLessonTime(lesson.startsAt)}</p>
          </div>
          <button type="button" className="live-btn" onClick={() => navigate(`/student/live-lessons/${lesson.id}`)}>Vào học</button>
        </section>
      ))}
      {soon.map((lesson) => (
        <section key={lesson.id} className="live-now-banner soon">
          <div>
            <strong>
              {lesson.minutesUntilStart > 0
                ? `Còn ${lesson.minutesUntilStart} phút nữa: ${lesson.topic}`
                : `Đã tới giờ, chờ giảng viên: ${lesson.topic}`}
            </strong>
            <p>Vào phòng chờ. Bạn không tự phát video được.</p>
          </div>
          <button type="button" className="live-btn" onClick={() => navigate(`/student/live-lessons/${lesson.id}`)}>Vào phòng</button>
        </section>
      ))}
      {comingUp.map((lesson) => (
        <section key={lesson.id} className="live-now-banner scheduled">
          <div>
            <strong>Đã lên lịch hôm nay / ngày mai: {lesson.topic}</strong>
            <p>{lesson.courseId} · {formatLessonTime(lesson.startsAt)} · sẽ nhắc trước 10 phút</p>
          </div>
          <button type="button" className="live-btn secondary" onClick={() => navigate(`/student/live-lessons/${lesson.id}`)}>Xem phòng</button>
        </section>
      ))}

      <section className="live-lesson-list">
        <h2>Các buổi của lớp</h2>
        {lessons.length === 0 && <p className="live-empty">Chưa có buổi live nào cho các lớp bạn đang học.</p>}
        <div className="live-lesson-grid">
          {lessons.map((lesson) => (
            <article key={lesson.id} className="live-lesson-card">
              <div>
                <span className={`live-status ${lesson.status}`}>{STATUS_LABEL[lesson.status] || lesson.status}</span>
                <h3>{lesson.topic}</h3>
                <p>{lesson.courseId} · {lesson.classId} · {formatLessonTime(lesson.startsAt)}</p>
              </div>
              <button
                type="button"
                className="live-btn"
                onClick={() => navigate(`/student/live-lessons/${lesson.id}`)}
              >
                {lesson.status === 'ENDED' ? 'Xem phòng / chat' : 'Vào phòng'}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

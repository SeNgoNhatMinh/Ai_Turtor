import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { liveLessonApi } from '../../services/liveLessonApi';
import { asLessonList, formatLessonTime, isStartingWithinHours } from './liveLessonUtils';
import './live-lesson.css';

export default function LiveNowBanner({ courseId, classId }) {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = () => liveLessonApi.list({ courseId, classId })
      .then((payload) => {
        const next = asLessonList(payload);
        if (cancelled) return;
        setLessons(next.filter((lesson) => (
          lesson.playbackActive || lesson.upcomingSoon || isStartingWithinHours(lesson, 24)
        )));
      })
      .catch(() => {
        if (!cancelled) setLessons([]);
      });
    load();
    const timer = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [courseId, classId]);

  if (lessons.length === 0) return null;

  return lessons.map((lesson) => {
    const live = lesson.playbackActive || lesson.status === 'LIVE';
    const soon = !live && lesson.upcomingSoon;
    const tone = live ? 'live' : soon ? 'soon' : 'scheduled';
    const heading = live
      ? `Lớp đang live: ${lesson.topic}`
      : soon
        ? (lesson.minutesUntilStart > 0
          ? `Còn ${lesson.minutesUntilStart} phút nữa: ${lesson.topic}`
          : `Đã tới giờ, chờ giảng viên: ${lesson.topic}`)
        : `Đã lên lịch: ${lesson.topic}`;
    return (
      <section key={lesson.id} className={`live-now-banner ${tone}`}>
        <div>
          <strong>{heading}</strong>
          <p>{lesson.courseId} · {formatLessonTime(lesson.startsAt)}</p>
        </div>
        <button type="button" className="live-btn" onClick={() => navigate(`/student/live-lessons/${lesson.id}`)}>
          {live ? 'Vào học ngay' : soon ? 'Vào phòng chờ' : 'Xem lịch'}
        </button>
      </section>
    );
  });
}

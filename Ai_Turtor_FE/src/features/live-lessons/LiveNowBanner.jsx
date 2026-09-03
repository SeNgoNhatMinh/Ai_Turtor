import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { liveLessonApi } from '../../services/liveLessonApi';
import { asLessonList, formatLessonTime, notifyUpcomingLesson } from './liveLessonUtils';
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
        setLessons(next.filter((lesson) => lesson.playbackActive || lesson.upcomingSoon));
        next.filter((lesson) => lesson.upcomingSoon).forEach(notifyUpcomingLesson);
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
    return (
      <section key={lesson.id} className={`live-now-banner ${live ? 'live' : 'soon'}`}>
        <div>
          <strong>
            {live
              ? `Lớp đang live: ${lesson.topic}`
              : lesson.minutesUntilStart > 0
                ? `Còn ${lesson.minutesUntilStart} phút nữa: ${lesson.topic}`
                : `Đã tới giờ, chờ giảng viên: ${lesson.topic}`}
          </strong>
          <p>{lesson.courseId} · {formatLessonTime(lesson.startsAt)}</p>
        </div>
        <button type="button" className="live-btn" onClick={() => navigate(`/student/live-lessons/${lesson.id}`)}>
          {live ? 'Vào học ngay' : 'Vào phòng chờ'}
        </button>
      </section>
    );
  });
}

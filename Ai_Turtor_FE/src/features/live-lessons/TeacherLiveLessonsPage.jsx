import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import { liveLessonApi } from '../../services/liveLessonApi';
import { getUserFacingError } from '../../services/httpClient';
import { useTeacherDashboard } from '../teacher/dashboard/useTeacherDashboard';
import { getClassCourseId, getClassOptionLabel, getClassOptionValue } from '../teacher/shared/teacherUtils';
import { youtubeVideoId } from '../../utils/youtubeVideo';
import {
  asLessonList,
  formatLessonTime,
  fromDateTimeLocalValue,
  STATUS_LABEL,
  toDateTimeLocalValue,
} from './liveLessonUtils';
import './live-lesson.css';

const emptyForm = () => ({
  topic: '',
  youtubeUrl: '',
  startsAt: toDateTimeLocalValue(),
});

export default function TeacherLiveLessonsPage({
  currentUser,
  teacherId,
  courseId,
  setCourseId,
  classId,
  setClassId,
  triggerToast,
}) {
  const navigate = useNavigate();
  const dashboard = useTeacherDashboard({ teacherId, courseId, classId });
  const [lessons, setLessons] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [saving, setSaving] = useState(false);

  const classOptions = dashboard.classesList || [];
  const selectedClass = useMemo(
    () => classOptions.find((item) => getClassOptionValue(item) === classId) || classOptions[0],
    [classId, classOptions],
  );

  const loadLessons = async () => {
    const payload = await liveLessonApi.list({
      courseId: courseId || getClassCourseId(selectedClass),
      classId: classId || getClassOptionValue(selectedClass),
    });
    setLessons(asLessonList(payload));
  };

  useEffect(() => {
    dashboard.loadTeacherDashboard();
  }, [teacherId, courseId, classId]);

  useEffect(() => {
    if (!teacherId) return;
    loadLessons().catch((error) => triggerToast?.(getUserFacingError(error), 'error'));
  }, [teacherId, courseId, classId]);

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const resetForm = () => {
    setEditingId('');
    setForm(emptyForm());
  };

  const beginEdit = (lesson) => {
    setEditingId(lesson.id);
    setForm({
      topic: lesson.topic || '',
      youtubeUrl: lesson.youtubeUrl || '',
      startsAt: toDateTimeLocalValue(lesson.startsAt ? new Date(lesson.startsAt) : new Date()),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!youtubeVideoId(form.youtubeUrl)) {
      triggerToast?.('Dán link YouTube hợp lệ (watch, youtu.be hoặc embed).', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      courseId: courseId || getClassCourseId(selectedClass),
      classId: classId || getClassOptionValue(selectedClass),
      topic: form.topic,
      youtubeUrl: form.youtubeUrl,
      startsAt: fromDateTimeLocalValue(form.startsAt),
    };
    try {
      if (editingId) {
        await liveLessonApi.update(editingId, payload);
        triggerToast?.('Đã cập nhật buổi live.', 'success');
      } else {
        await liveLessonApi.create(payload, currentUser?.fullName || currentUser?.name);
        triggerToast?.('Đã tạo buổi live. Sinh viên sẽ được báo trước 10 phút.', 'success');
      }
      resetForm();
      await loadLessons();
    } catch (error) {
      triggerToast?.(getUserFacingError(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action) => {
    try {
      await action();
      await loadLessons();
    } catch (error) {
      triggerToast?.(getUserFacingError(error), 'error');
    }
  };

  return (
    <div className="portal-section live-lesson-page">
      <PageHeader
        eyebrow="Học thêm"
        title="Live video lớp"
        description="Lên lịch video đã quay. Tới giờ sinh viên vào chờ; chỉ bạn bấm bắt đầu thì video mới chạy. Xem lại bằng link YouTube gửi trên chat."
      />

      <section className="live-lesson-form-card">
        <h2>{editingId ? 'Sửa buổi live' : 'Tạo buổi live mới'}</h2>
        <form className="live-lesson-form" onSubmit={submit}>
          <label>
            Lớp
            <select
              value={classId || getClassOptionValue(selectedClass) || ''}
              onChange={(event) => {
                const next = classOptions.find((item) => getClassOptionValue(item) === event.target.value);
                if (next) {
                  setClassId?.(getClassOptionValue(next));
                  setCourseId?.(getClassCourseId(next));
                }
              }}
            >
              {classOptions.map((item) => (
                <option key={getClassOptionValue(item)} value={getClassOptionValue(item)}>
                  {getClassCourseId(item)} · {getClassOptionLabel(item)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Giờ bắt đầu (báo SV trước 10 phút)
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) => updateField('startsAt', event.target.value)}
              required
            />
          </label>
          <label className="live-span-2">
            Chủ đề bài giảng
            <input
              value={form.topic}
              onChange={(event) => updateField('topic', event.target.value)}
              placeholder="Lập trình hướng đối tượng"
              required
            />
          </label>
          <label className="live-span-2">
            Link YouTube đã quay
            <input
              value={form.youtubeUrl}
              onChange={(event) => updateField('youtubeUrl', event.target.value)}
              placeholder="https://youtu.be/..."
              required
            />
          </label>
          <div className="live-span-2 live-lesson-actions">
            <button className="live-btn" type="submit" disabled={saving}>
              {saving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Tạo buổi live'}
            </button>
            {editingId && (
              <button type="button" className="live-btn ghost" onClick={resetForm}>Hủy sửa</button>
            )}
          </div>
        </form>
      </section>

      <section className="live-lesson-list">
        <h2>Buổi đã tạo</h2>
        {lessons.length === 0 && <p className="live-empty">Chưa có buổi live nào cho lớp đang chọn.</p>}
        <div className="live-lesson-grid">
          {lessons.map((lesson) => (
            <article key={lesson.id} className="live-lesson-card">
              <div>
                <span className={`live-status ${lesson.status}`}>{STATUS_LABEL[lesson.status] || lesson.status}</span>
                <h3>{lesson.topic}</h3>
                <p>{lesson.courseId} · {lesson.classId} · {formatLessonTime(lesson.startsAt)}</p>
              </div>
              <div className="live-lesson-actions">
                <button type="button" className="live-btn" onClick={() => navigate(`/teacher/live-lessons/${lesson.id}`)}>
                  Vào phòng
                </button>
                {lesson.status === 'SCHEDULED' && !lesson.playbackActive && (
                  <>
                    <button type="button" className="live-btn secondary" onClick={() => beginEdit(lesson)}>Sửa</button>
                    <button
                      type="button"
                      className="live-btn danger"
                      onClick={() => {
                        if (window.confirm('Xóa buổi live này?')) {
                          runAction(() => liveLessonApi.remove(lesson.id));
                        }
                      }}
                    >
                      Xóa
                    </button>
                  </>
                )}
                {lesson.status === 'ENDED' && (
                  <button
                    type="button"
                    className="live-btn ghost"
                    onClick={() => {
                      if (window.confirm('Xóa buổi đã kết thúc khỏi danh sách?')) {
                        runAction(() => liveLessonApi.remove(lesson.id));
                      }
                    }}
                  >
                    Xóa
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

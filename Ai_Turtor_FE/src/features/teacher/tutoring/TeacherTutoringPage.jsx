import { useEffect, useState } from 'react';
import { Drawer } from 'antd';
import PageHeader from '../../../components/common/PageHeader';
import { getUserFacingError } from '../../../services/apiClient';
import { asArray } from '../../../services/normalizers';
import { tutorSessionApi } from '../../../services/tutorSessionApi';
import './TeacherTutoringPage.css';

export default function TeacherTutoringPage({
  teacherId,
  courseId,
  classId,
  triggerToast,
}) {
  const [summaries, setSummaries] = useState([]);
  const [directives, setDirectives] = useState([]);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    studentId: '',
    topic: '',
    instruction: '',
    supportLevel: 'STANDARD',
  });

  const load = async () => {
    if (!teacherId || !courseId || !classId) return;
    setLoading(true);
    try {
      const [summaryData, directiveData] = await Promise.all([
        tutorSessionApi.listTeacherSummaries(teacherId, courseId, classId),
        tutorSessionApi.listDirectives(teacherId, courseId, classId),
      ]);
      setSummaries(asArray(summaryData, 'summaries', 'items', 'content'));
      setDirectives(asArray(directiveData, 'directives', 'items', 'content'));
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể tải dữ liệu gia sư của lớp.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
    // Tutor data is scoped by the selected assigned class.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, courseId, classId]);

  const openTranscript = async (summary) => {
    setSelectedSummary(summary);
    setTranscript([]);
    try {
      const data = await tutorSessionApi.getTranscript(teacherId, summary.id);
      setTranscript(asArray(data, 'messages', 'content', 'items'));
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể tải toàn bộ hội thoại.'));
    }
  };

  const createDirective = async (event) => {
    event.preventDefault();
    if (!form.instruction.trim()) return;
    setSaving(true);
    try {
      const draft = await tutorSessionApi.createDirective(teacherId, {
        ...form,
        studentId: form.studentId.trim() || null,
        topic: form.topic.trim() || null,
        instruction: form.instruction.trim(),
        courseId,
        classId,
      });
      await tutorSessionApi.confirmDirective(teacherId, draft.id);
      setForm({ studentId: '', topic: '', instruction: '', supportLevel: 'STANDARD' });
      triggerToast?.('Đã xác nhận chỉ dẫn. AI Tutor sẽ áp dụng từ lượt học tiếp theo.');
      await load();
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể lưu chỉ dẫn sư phạm.'));
    } finally {
      setSaving(false);
    }
  };

  const archiveDirective = async (directiveId) => {
    try {
      await tutorSessionApi.archiveDirective(teacherId, directiveId);
      await load();
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể ngừng áp dụng chỉ dẫn.'));
    }
  };

  return (
    <div className="portal-section teacher-tutoring-page">
      <PageHeader
        eyebrow="Pedagogical Memory"
        title="Theo dõi AI Tutor theo từng sinh viên"
        description="Xem tóm tắt mỗi 10 lượt học, đọc hội thoại và truyền chỉ dẫn sư phạm cho AI Tutor."
      />

      <div className="teacher-tutoring-grid">
        <section className="teacher-tutoring-card">
          <h2>Chỉ dẫn đang áp dụng</h2>
          <form className="teacher-directive-form" onSubmit={createDirective}>
            <input
              value={form.studentId}
              onChange={(event) => setForm((value) => ({ ...value, studentId: event.target.value }))}
              placeholder="Mã sinh viên (để trống = cả lớp)"
            />
            <input
              value={form.topic}
              onChange={(event) => setForm((value) => ({ ...value, topic: event.target.value }))}
              placeholder="Chủ đề áp dụng"
            />
            <select
              value={form.supportLevel}
              onChange={(event) => setForm((value) => ({ ...value, supportLevel: event.target.value }))}
            >
              <option value="HIGH_SUPPORT">Hướng dẫn kỹ, từng bước</option>
              <option value="STANDARD">Cân bằng giải thích và thực hành</option>
              <option value="CHALLENGE">Tăng thử thách, giảm gợi ý</option>
            </select>
            <textarea
              value={form.instruction}
              onChange={(event) => setForm((value) => ({ ...value, instruction: event.target.value }))}
              placeholder="Nhận xét/chỉ dẫn của giảng viên..."
              rows={4}
              required
            />
            <button type="submit" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Xác nhận và áp dụng'}
            </button>
          </form>
          <div className="teacher-directive-list">
            {directives.filter((item) => item.status === 'CONFIRMED').map((item) => (
              <article key={item.id}>
                <strong>{item.studentId || 'Cả lớp'} · {item.supportLevel}</strong>
                <p>{item.instruction}</p>
                <button type="button" onClick={() => archiveDirective(item.id)}>Ngừng áp dụng</button>
              </article>
            ))}
          </div>
        </section>

        <section className="teacher-tutoring-card teacher-session-feed">
          <h2>Buổi học đã gửi cho giảng viên</h2>
          {loading && <p>Đang tải...</p>}
          {!loading && summaries.length === 0 && <p>Chưa có buổi học đủ 10 lượt để tổng kết.</p>}
          {summaries.map((summary) => (
            <article key={summary.id}>
              <div>
                <strong>{summary.studentId} · {summary.topic || 'Học tự do'}</strong>
                <span>{summary.studentTurnCount || 0} lượt · {summary.supportLevel}</span>
              </div>
              <p>{summary.summaryText}</p>
              {summary.misconceptions?.length > 0 && (
                <small>Cần củng cố: {summary.misconceptions.join(', ')}</small>
              )}
              <button type="button" onClick={() => openTranscript(summary)}>Xem hội thoại đầy đủ</button>
            </article>
          ))}
        </section>
      </div>

      <Drawer
        title={`Hội thoại của ${selectedSummary?.studentId || 'sinh viên'}`}
        width={640}
        open={Boolean(selectedSummary)}
        onClose={() => setSelectedSummary(null)}
      >
        <div className="teacher-transcript">
          {transcript.map((message) => (
            <article key={message.id} className={message.role === 'STUDENT' ? 'is-student' : 'is-tutor'}>
              <strong>{message.role === 'STUDENT' ? 'Sinh viên' : 'AI Tutor'}</strong>
              <p>{message.content}</p>
            </article>
          ))}
        </div>
      </Drawer>
    </div>
  );
}

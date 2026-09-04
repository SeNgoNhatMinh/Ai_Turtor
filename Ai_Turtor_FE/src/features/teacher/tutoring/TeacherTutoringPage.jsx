import { useEffect, useMemo, useState } from 'react';
import { Drawer } from 'antd';
import PageHeader from '../../../components/common/PageHeader';
import MarkdownRenderer from '../../../components/markdown/MarkdownRenderer';
import StudentMessageContent from '../../student/chat/components/StudentMessageContent';
import { getUserFacingError } from '../../../services/apiClient';
import { asArray } from '../../../services/normalizers';
import { teacherApi } from '../../../services/teacherApi';
import { tutorSessionApi } from '../../../services/tutorSessionApi';
import { getPersonDisplayName, getPersonEmail } from '../../../utils/displayNames';
import {
  buildClassStudentRows,
  formatTeacherStudentLabel,
  formatTutorWhen,
  mergeRosterIdentity,
  sessionHeadline,
  sessionStatusLabel,
  studentInitials,
  studentSearchText,
  supportLevelLabel,
} from './teacherTutoringStudents';
import './TeacherTutoringPage.css';

function TopicList({ label, items, tone = 'default', wrap = false }) {
  if (!items?.length) return null;
  return (
    <div className={`teacher-topic-list${tone === 'weak' ? ' is-weak' : ''}${wrap ? ' is-wrap' : ''}`}>
      {label ? <span>{label}</span> : null}
      <ul>
        {items.slice(0, wrap ? 12 : 6).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function TeacherTutoringPage({
  teacherId,
  courseId,
  classId,
  triggerToast,
}) {
  const [summaries, setSummaries] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [directives, setDirectives] = useState([]);
  const [students, setStudents] = useState([]);
  const [memories, setMemories] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
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
      const [summaryData, sessionData, directiveData, studentData, memoryData] = await Promise.all([
        tutorSessionApi.listTeacherSummaries(teacherId, courseId, classId),
        tutorSessionApi.listTeacherSessions(teacherId, courseId, classId).catch(() => ({ sessions: [] })),
        tutorSessionApi.listDirectives(teacherId, courseId, classId),
        teacherApi.getClassStudents(courseId, classId, teacherId).catch(() => ({ students: [] })),
        teacherApi.getCourseMemories(courseId, classId).catch(() => ({ memories: [] })),
      ]);
      const roster = asArray(studentData, 'students', 'items', 'content');
      setStudents(roster);
      setMemories(asArray(memoryData, 'memories', 'items', 'content'));
      setSessions(
        asArray(sessionData, 'sessions', 'items', 'content').map((item) => mergeRosterIdentity(item, roster)),
      );
      setSummaries(
        asArray(summaryData, 'summaries', 'items', 'content').map((item) => mergeRosterIdentity(item, roster)),
      );
      setDirectives(
        asArray(directiveData, 'directives', 'items', 'content').map((item) => mergeRosterIdentity(item, roster)),
      );
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

  const studentRows = useMemo(
    () => buildClassStudentRows({ roster: students, memories, sessions, summaries }),
    [memories, sessions, students, summaries],
  );

  const visibleStudents = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return studentRows;
    return studentRows.filter((student) => studentSearchText(student).includes(keyword));
  }, [query, studentRows]);

  const studiedCount = studentRows.filter((student) => student.hasActivity).length;
  const weakCount = studentRows.filter((student) => student.weakTopics.length > 0).length;

  const openStudent = (student) => {
    setSelectedStudent(student);
    setSelectedSummary(null);
    setTranscript([]);
    setForm((value) => ({
      ...value,
      studentId: student.studentId || '',
    }));
  };

  const openTranscript = async (summary) => {
    setSelectedSummary(summary);
    setTranscript([]);
    try {
      const data = await tutorSessionApi.getTranscript(teacherId, summary.id);
      const nextSummary = mergeRosterIdentity(data?.summary || summary, students);
      setSelectedSummary(nextSummary);
      setTranscript(asArray(data, 'messages', 'content', 'items'));
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể tải toàn bộ hội thoại.'));
    }
  };

  const openSessionTranscript = async (session) => {
    setSelectedSummary({
      ...session,
      topic: session.topic || 'Học tự do',
    });
    setTranscript([]);
    try {
      const data = await tutorSessionApi.getSessionTranscript(teacherId, session.id);
      setSelectedSummary(mergeRosterIdentity(data?.session || session, students));
      setTranscript(asArray(data, 'messages', 'content', 'items'));
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể tải toàn bộ hội thoại.'));
    }
  };

  const closeTranscript = () => {
    setSelectedSummary(null);
    setTranscript([]);
  };

  const applyDirectiveToStudent = (student, topic = '') => {
    setForm((value) => ({
      ...value,
      studentId: student.studentId || '',
      topic: topic || value.topic,
    }));
    window.document.querySelector('.teacher-directive-form textarea')?.focus();
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

  const selectedStudentLabel = formatTeacherStudentLabel(selectedStudent || selectedSummary, 'sinh viên');

  return (
    <div className="portal-section teacher-tutoring-page">
      <PageHeader
        eyebrow="AI Tutor"
        title="Theo dõi AI Tutor theo từng sinh viên"
        description="Xem bài đã học của cả lớp và gửi chỉ dẫn sư phạm cho AI Tutor."
        actions={(
          <div className="teacher-tutoring-stats">
            <div>
              <strong>{studentRows.length}</strong>
              <span>Sinh viên</span>
            </div>
            <div>
              <strong>{studiedCount}</strong>
              <span>Đã học</span>
            </div>
            <div>
              <strong>{weakCount}</strong>
              <span>Cần củng cố</span>
            </div>
          </div>
        )}
      />

      <div className="teacher-tutoring-grid">
        <section className="teacher-tutoring-card">
          <h2>Chỉ dẫn đang áp dụng</h2>
          <form className="teacher-directive-form" onSubmit={createDirective}>
            <label className="teacher-directive-field">
              <span>Sinh viên</span>
              <select
                value={form.studentId}
                onChange={(event) => setForm((value) => ({ ...value, studentId: event.target.value }))}
              >
                <option value="">Cả lớp</option>
                {studentRows.map((student) => (
                  <option key={student.studentId || student.id} value={student.studentId || student.id}>
                    {formatTeacherStudentLabel(student)}
                  </option>
                ))}
              </select>
            </label>
            <label className="teacher-directive-field">
              <span>Chủ đề áp dụng</span>
              <input
                value={form.topic}
                onChange={(event) => setForm((value) => ({ ...value, topic: event.target.value }))}
                placeholder="Ví dụ: Cache L2/L3"
              />
            </label>
            <label className="teacher-directive-field">
              <span>Mức hỗ trợ</span>
              <select
                value={form.supportLevel}
                onChange={(event) => setForm((value) => ({ ...value, supportLevel: event.target.value }))}
              >
                <option value="HIGH_SUPPORT">Hướng dẫn kỹ, từng bước</option>
                <option value="STANDARD">Cân bằng giải thích và thực hành</option>
                <option value="CHALLENGE">Tăng thử thách, giảm gợi ý</option>
              </select>
            </label>
            <label className="teacher-directive-field">
              <span>Nhận xét / chỉ dẫn</span>
              <textarea
                value={form.instruction}
                onChange={(event) => setForm((value) => ({ ...value, instruction: event.target.value }))}
                placeholder="Nhận xét/chỉ dẫn của giảng viên..."
                rows={4}
                required
              />
            </label>
            <button type="submit" className="teacher-tutoring-btn" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Xác nhận và áp dụng'}
            </button>
          </form>
          <div className="teacher-directive-list">
            {directives.filter((item) => item.status === 'CONFIRMED').map((item) => (
              <article key={item.id} className="teacher-directive-item">
                <strong>
                  {item.studentId ? formatTeacherStudentLabel(item, 'Sinh viên') : 'Cả lớp'}
                  {' · '}
                  {supportLevelLabel(item.supportLevel)}
                </strong>
                <p>{item.instruction}</p>
                <button
                  type="button"
                  className="teacher-tutoring-btn teacher-tutoring-btn--danger"
                  onClick={() => archiveDirective(item.id)}
                >
                  Ngừng áp dụng
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="teacher-tutoring-card teacher-session-feed">
          <div className="teacher-session-feed__header">
            <h2>Danh sách sinh viên</h2>
            <p className="teacher-session-feed__hint">
              {studentRows.length} sinh viên trong lớp. Bấm một thẻ để xem bài đã học.
            </p>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên, mã SV hoặc chủ đề đã học"
              aria-label="Tìm sinh viên"
            />
          </div>
          {loading && <p className="teacher-tutoring-empty">Đang tải...</p>}
          {!loading && studentRows.length === 0 && (
            <p className="teacher-tutoring-empty">Lớp chưa có sinh viên được ghi danh.</p>
          )}
          {!loading && studentRows.length > 0 && visibleStudents.length === 0 && (
            <p className="teacher-tutoring-empty">Không tìm thấy sinh viên khớp với từ khóa.</p>
          )}
          <div className="teacher-student-list">
            {visibleStudents.map((student) => (
              <article key={student.studentId || student.id} className="teacher-student-card">
                <div className="teacher-student-card__identity">
                  <span className="teacher-student-card__avatar">{studentInitials(student)}</span>
                  <div className="teacher-student-card__copy">
                    <strong>{formatTeacherStudentLabel(student)}</strong>
                    <span>{getPersonEmail(student) || 'Chưa có email'}</span>
                  </div>
                  <em className={`teacher-student-status${student.hasActivity ? '' : ' is-idle'}`}>
                    {student.activityLabel}
                  </em>
                </div>
                <TopicList label="Đã học" items={student.studiedTopics} />
                <TopicList label="Cần củng cố" items={student.weakTopics} tone="weak" />
                <div className="teacher-session-actions">
                  <button type="button" className="teacher-tutoring-btn" onClick={() => openStudent(student)}>
                    Xem bài đã học
                  </button>
                  <button
                    type="button"
                    className="teacher-tutoring-btn is-secondary"
                    onClick={() => applyDirectiveToStudent(student, student.studiedTopics[0] || '')}
                  >
                    Gửi chỉ dẫn
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <Drawer
        title={selectedSummary ? 'Hội thoại' : 'Bài đã học'}
        width={760}
        className="teacher-transcript-drawer"
        rootClassName="teacher-transcript-drawer"
        open={Boolean(selectedStudent)}
        onClose={() => {
          setSelectedStudent(null);
          closeTranscript();
        }}
      >
        {selectedStudent && !selectedSummary && (
          <div className="teacher-student-detail">
            <header className="teacher-detail-hero">
              <span className="teacher-student-card__avatar">{studentInitials(selectedStudent)}</span>
              <div>
                <strong>{selectedStudentLabel}</strong>
                <span>{getPersonEmail(selectedStudent) || 'Chưa có email'}</span>
              </div>
            </header>

            <section className="teacher-detail-section">
              <h3>Chủ đề đã học</h3>
              {selectedStudent.studiedTopics?.length ? (
                <TopicList items={selectedStudent.studiedTopics} wrap />
              ) : (
                <p className="teacher-tutoring-empty">Chưa ghi nhận chủ đề ngắn từ buổi học.</p>
              )}
            </section>

            {selectedStudent.weakTopics?.length > 0 && (
              <section className="teacher-detail-section">
                <h3>Cần củng cố</h3>
                <TopicList items={selectedStudent.weakTopics} tone="weak" wrap />
              </section>
            )}

            {selectedStudent.recentQuestions?.length > 0 && (
              <section className="teacher-detail-section">
                <h3>Câu hỏi gần đây</h3>
                <ol className="teacher-question-list">
                  {selectedStudent.recentQuestions.slice(0, 8).map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ol>
              </section>
            )}

            {!selectedStudent.hasActivity && (
              <p className="teacher-transcript__empty">Sinh viên này chưa học với AI Tutor.</p>
            )}

            {selectedStudent.sessions?.length > 0 && (
              <section className="teacher-detail-section">
                <h3>Buổi học</h3>
                <div className="teacher-detail-stack">
                  {selectedStudent.sessions.map((session) => (
                    <article key={session.id} className="teacher-detail-item">
                      <div>
                        <strong>{sessionHeadline(session, selectedStudent.studiedTopics)}</strong>
                        <span>
                          {sessionStatusLabel(session.status)}
                          {' · '}
                          {session.studentTurnCount || 0} lượt
                          {formatTutorWhen(session.updatedAt || session.startedAt)
                            ? ` · ${formatTutorWhen(session.updatedAt || session.startedAt)}`
                            : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="teacher-tutoring-btn"
                        onClick={() => openSessionTranscript(session)}
                      >
                        Xem hội thoại
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {selectedStudent.summaries?.length > 0 && (
              <section className="teacher-detail-section">
                <h3>Tổng kết gửi giảng viên</h3>
                <div className="teacher-detail-stack">
                  {selectedStudent.summaries.map((summary) => (
                    <article key={summary.id} className="teacher-detail-item">
                      <div>
                        <strong>{sessionHeadline(summary, selectedStudent.studiedTopics)}</strong>
                        <span>
                          {summary.studentTurnCount || 0} lượt
                          {' · '}
                          {supportLevelLabel(summary.supportLevel)}
                          {formatTutorWhen(summary.createdAt || summary.sharedWithTeacherAt)
                            ? ` · ${formatTutorWhen(summary.createdAt || summary.sharedWithTeacherAt)}`
                            : ''}
                        </span>
                      </div>
                      {summary.summaryText ? <p>{summary.summaryText}</p> : null}
                      <button
                        type="button"
                        className="teacher-tutoring-btn"
                        onClick={() => openTranscript(summary)}
                      >
                        Xem hội thoại đầy đủ
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {selectedStudent && selectedSummary && (
          <div className="teacher-transcript">
            <button type="button" className="teacher-tutoring-btn is-secondary" onClick={closeTranscript}>
              ← Quay lại bài đã học
            </button>
            <header className="teacher-detail-hero">
              <span className="teacher-student-card__avatar">{studentInitials(selectedStudent)}</span>
              <div>
                <strong>{sessionHeadline(selectedSummary, selectedStudent.studiedTopics)}</strong>
                <span>{selectedStudentLabel}</span>
              </div>
            </header>
            {transcript.length === 0 && (
              <p className="teacher-transcript__empty">Chưa có tin nhắn trong buổi học này.</p>
            )}
            {transcript.map((message) => {
              const isStudent = message.role === 'STUDENT';
              return (
                <article
                  key={message.id}
                  className={isStudent ? 'teacher-transcript__turn is-student' : 'teacher-transcript__turn is-tutor'}
                >
                  <strong>{isStudent ? getPersonDisplayName(selectedStudent, 'Sinh viên') : 'AI Tutor'}</strong>
                  {isStudent ? (
                    <div className="teacher-transcript__bubble">
                      <StudentMessageContent text={message.content} />
                    </div>
                  ) : (
                    <div className="teacher-transcript__markdown">
                      <MarkdownRenderer markdown={message.content || ''} hideSourceSection />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </Drawer>
    </div>
  );
}

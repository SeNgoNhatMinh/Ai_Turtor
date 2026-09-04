import { useEffect, useMemo, useState } from 'react';
import { Drawer } from 'antd';
import PageHeader from '../../../components/common/PageHeader';
import { getUserFacingError } from '../../../services/apiClient';
import { asArray } from '../../../services/normalizers';
import { teacherApi } from '../../../services/teacherApi';
import { tutorSessionApi } from '../../../services/tutorSessionApi';
import { getPersonEmail } from '../../../utils/displayNames';
import {
  buildClassStudentRows,
  formatTeacherStudentLabel,
  formatTutorWhen,
  groupRowsByClass,
  mergeRosterIdentity,
  sessionHeadline,
  sessionStatusLabel,
  studentInitials,
  studentSearchText,
  supportLevelLabel,
  uniqueClassScopes,
} from './teacherTutoringStudents';
import TeacherTranscriptThread from './TeacherTranscriptThread';
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
  setCourseId,
  setClassId,
  triggerToast,
}) {
  const [classScopes, setClassScopes] = useState([]);
  const [studentRows, setStudentRows] = useState([]);
  const [directives, setDirectives] = useState([]);
  const [activeClassKey, setActiveClassKey] = useState('ALL');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({
    classKey: '',
    studentId: '',
    topic: '',
    instruction: '',
    supportLevel: 'STANDARD',
  });

  const loadClassBundle = async (scope) => {
    const [summaryData, sessionData, directiveData, studentData, memoryData] = await Promise.all([
      tutorSessionApi.listTeacherSummaries(teacherId, scope.courseId, scope.classId).catch(() => ({ summaries: [] })),
      tutorSessionApi.listTeacherSessions(teacherId, scope.courseId, scope.classId).catch(() => ({ sessions: [] })),
      tutorSessionApi.listDirectives(teacherId, scope.courseId, scope.classId).catch(() => ({ directives: [] })),
      teacherApi.getClassStudents(scope.courseId, scope.classId, teacherId).catch(() => ({ students: [] })),
      teacherApi.getCourseMemories(scope.courseId, scope.classId).catch(() => ({ memories: [] })),
    ]);
    const roster = asArray(studentData, 'students', 'items', 'content');
    return {
      students: buildClassStudentRows({
        roster,
        memories: asArray(memoryData, 'memories', 'items', 'content'),
        sessions: asArray(sessionData, 'sessions', 'items', 'content').map((item) => mergeRosterIdentity(item, roster)),
        summaries: asArray(summaryData, 'summaries', 'items', 'content').map((item) => mergeRosterIdentity(item, roster)),
        courseId: scope.courseId,
        classId: scope.classId,
        classLabel: scope.label,
      }),
      directives: asArray(directiveData, 'directives', 'items', 'content').map((item) => ({
        ...mergeRosterIdentity(item, roster),
        courseId: scope.courseId,
        classId: scope.classId,
        classKey: scope.key,
        classLabel: scope.label,
      })),
    };
  };

  const load = async () => {
    if (!teacherId) return;
    setLoading(true);
    try {
      let assigned = [];
      try {
        const classData = await teacherApi.getClassSections(teacherId);
        assigned = asArray(classData, 'classes', 'classSections', 'content');
      } catch {
        assigned = [];
      }
      const scopes = uniqueClassScopes(assigned, { courseId, classId });
      if (!scopes.length) {
        setClassScopes([]);
        setStudentRows([]);
        setDirectives([]);
        return;
      }
      const bundles = await Promise.all(scopes.map((scope) => loadClassBundle(scope)));
      setClassScopes(scopes);
      setStudentRows(bundles.flatMap((bundle) => bundle.students));
      setDirectives(bundles.flatMap((bundle) => bundle.directives));
      setActiveClassKey((current) => {
        if (current === 'ALL' && scopes.length > 1) return current;
        if (scopes.some((scope) => scope.key === current)) return current;
        const preferred = scopes.find((scope) => (
          String(scope.courseId).toUpperCase() === String(courseId || '').toUpperCase()
          && String(scope.classId).toUpperCase() === String(classId || '').toUpperCase()
        ));
        if (preferred) return preferred.key;
        return scopes.length === 1 ? scopes[0].key : 'ALL';
      });
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể tải dữ liệu gia sư của lớp.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
    // Reload when the signed-in teacher changes; class tabs then pick the assigned sections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  const scopedRows = useMemo(() => {
    if (activeClassKey === 'ALL') return studentRows;
    return studentRows.filter((student) => student.classKey === activeClassKey);
  }, [activeClassKey, studentRows]);

  const visibleGroups = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const rows = keyword
      ? scopedRows.filter((student) => studentSearchText(student).includes(keyword))
      : scopedRows;
    return groupRowsByClass(rows);
  }, [query, scopedRows]);

  const visibleDirectives = useMemo(() => {
    const confirmed = directives.filter((item) => item.status === 'CONFIRMED');
    if (activeClassKey === 'ALL') return confirmed;
    return confirmed.filter((item) => item.classKey === activeClassKey);
  }, [activeClassKey, directives]);

  const formStudents = useMemo(() => {
    const key = form.classKey || (activeClassKey === 'ALL' ? '' : activeClassKey);
    if (!key) return studentRows;
    return studentRows.filter((student) => student.classKey === key);
  }, [activeClassKey, form.classKey, studentRows]);

  const studiedCount = scopedRows.filter((student) => student.hasActivity).length;
  const weakCount = scopedRows.filter((student) => student.weakTopics.length > 0).length;
  const activeScope = classScopes.find((scope) => scope.key === activeClassKey)
    || classScopes.find((scope) => scope.key === form.classKey)
    || classScopes[0];

  const selectClass = (key) => {
    setActiveClassKey(key);
    const scope = classScopes.find((item) => item.key === key);
    if (scope) {
      setCourseId?.(scope.courseId);
      setClassId?.(scope.classId);
    }
    setForm((value) => ({
      ...value,
      classKey: key === 'ALL' ? '' : key,
      studentId: '',
    }));
  };

  const openStudent = (student) => {
    setSelectedStudent(student);
    setSelectedSummary(null);
    setTranscript([]);
    setForm((value) => ({
      ...value,
      classKey: student.classKey || value.classKey,
      studentId: student.studentId || '',
    }));
  };

  const openTranscript = async (summary) => {
    setSelectedSummary(summary);
    setTranscript([]);
    try {
      const data = await tutorSessionApi.getTranscript(teacherId, summary.id);
      const nextSummary = mergeRosterIdentity(data?.summary || summary, studentRows);
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
      setSelectedSummary(mergeRosterIdentity(data?.session || session, studentRows));
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
      classKey: student.classKey || value.classKey,
      studentId: student.studentId || '',
      topic: topic || value.topic,
    }));
    if (student.classKey) setActiveClassKey(student.classKey);
    window.document.querySelector('.teacher-directive-form textarea')?.focus();
  };

  const createDirective = async (event) => {
    event.preventDefault();
    if (!form.instruction.trim()) return;
    const selectedStudentScope = studentRows.find((student) => student.studentId === form.studentId);
    const scope = classScopes.find((item) => item.key === (form.classKey || selectedStudentScope?.classKey || activeClassKey))
      || activeScope;
    if (!scope?.courseId || !scope?.classId) {
      triggerToast?.('Hãy chọn lớp trước khi gửi chỉ dẫn.');
      return;
    }
    setSaving(true);
    try {
      const draft = await tutorSessionApi.createDirective(teacherId, {
        studentId: form.studentId.trim() || null,
        topic: form.topic.trim() || null,
        instruction: form.instruction.trim(),
        supportLevel: form.supportLevel,
        courseId: scope.courseId,
        classId: scope.classId,
      });
      await tutorSessionApi.confirmDirective(teacherId, draft.id);
      setForm({ classKey: form.classKey || scope.key, studentId: '', topic: '', instruction: '', supportLevel: 'STANDARD' });
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
        title="Theo dõi AI Tutor theo từng lớp"
        description="Chọn lớp bạn phụ trách, xem bài đã học của từng sinh viên và gửi chỉ dẫn sư phạm cho AI Tutor."
        actions={(
          <div className="teacher-tutoring-stats">
            <div>
              <strong>{classScopes.length}</strong>
              <span>Lớp</span>
            </div>
            <div>
              <strong>{scopedRows.length}</strong>
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
            {classScopes.length > 0 && (
              <label className="teacher-directive-field">
                <span>Lớp áp dụng</span>
                <select
                  value={form.classKey || (activeClassKey === 'ALL' ? '' : activeClassKey)}
                  onChange={(event) => setForm((value) => ({
                    ...value,
                    classKey: event.target.value,
                    studentId: '',
                  }))}
                >
                  {classScopes.length > 1 && <option value="">Chọn lớp</option>}
                  {classScopes.map((scope) => (
                    <option key={scope.key} value={scope.key}>{scope.label}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="teacher-directive-field">
              <span>Sinh viên</span>
              <select
                value={form.studentId}
                onChange={(event) => setForm((value) => ({ ...value, studentId: event.target.value }))}
              >
                <option value="">Cả lớp</option>
                {formStudents.map((student) => (
                  <option key={`${student.classKey}-${student.studentId || student.id}`} value={student.studentId || student.id}>
                    {classScopes.length > 1
                      ? `${student.classId} · ${formatTeacherStudentLabel(student)}`
                      : formatTeacherStudentLabel(student)}
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
            {visibleDirectives.map((item) => (
              <article key={item.id} className="teacher-directive-item">
                <strong>
                  {item.classLabel ? `${item.classLabel} · ` : ''}
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
            <h2>Danh sách sinh viên theo lớp</h2>
            <p className="teacher-session-feed__hint">
              {classScopes.length > 1
                ? `${classScopes.length} lớp phụ trách · ${scopedRows.length} sinh viên${activeClassKey === 'ALL' ? '' : ` · ${activeScope?.label || ''}`}`
                : `${activeScope?.label || 'Lớp hiện tại'} · ${scopedRows.length} sinh viên`}
              . Bấm một thẻ để xem bài đã học.
            </p>
            {classScopes.length > 0 && (
              <div className="teacher-class-tabs" role="tablist" aria-label="Lọc theo lớp">
                {classScopes.length > 1 && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeClassKey === 'ALL'}
                    className={activeClassKey === 'ALL' ? 'is-active' : ''}
                    onClick={() => selectClass('ALL')}
                  >
                    Tất cả lớp
                    <em>{studentRows.length}</em>
                  </button>
                )}
                {classScopes.map((scope) => (
                  <button
                    key={scope.key}
                    type="button"
                    role="tab"
                    aria-selected={activeClassKey === scope.key}
                    className={activeClassKey === scope.key ? 'is-active' : ''}
                    onClick={() => selectClass(scope.key)}
                  >
                    {scope.label}
                    <em>{studentRows.filter((student) => student.classKey === scope.key).length}</em>
                  </button>
                ))}
              </div>
            )}
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên, mã SV hoặc chủ đề đã học"
              aria-label="Tìm sinh viên"
            />
          </div>
          {loading && <p className="teacher-tutoring-empty">Đang tải...</p>}
          {!loading && classScopes.length === 0 && (
            <p className="teacher-tutoring-empty">Bạn chưa được phân công lớp nào.</p>
          )}
          {!loading && classScopes.length > 0 && scopedRows.length === 0 && (
            <p className="teacher-tutoring-empty">Lớp này chưa có sinh viên được ghi danh.</p>
          )}
          {!loading && scopedRows.length > 0 && visibleGroups.length === 0 && (
            <p className="teacher-tutoring-empty">Không tìm thấy sinh viên khớp với từ khóa.</p>
          )}
          <div className="teacher-student-list">
            {visibleGroups.map((group) => (
              <section key={group.key} className="teacher-class-group">
                <header className="teacher-class-group__header">
                  <h3>{group.label}</h3>
                  <span>{group.students.length} sinh viên</span>
                </header>
                {group.students.map((student) => (
                  <article key={`${student.classKey}-${student.studentId || student.id}`} className="teacher-student-card">
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
              </section>
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
                <span>
                  {selectedStudent.classLabel ? `${selectedStudent.classLabel} · ` : ''}
                  {getPersonEmail(selectedStudent) || 'Chưa có email'}
                </span>
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
            {transcript.length === 0 ? (
              <p className="teacher-transcript__empty">Chưa có tin nhắn trong buổi học này.</p>
            ) : (
              <TeacherTranscriptThread messages={transcript} student={selectedStudent} />
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}

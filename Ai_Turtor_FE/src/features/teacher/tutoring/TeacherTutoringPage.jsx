import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Drawer } from 'antd';
import { queryKeys } from '../../../app/queryKeys';
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

const EMPTY_LIST = [];

const settledValue = (results, index, fallback) => (
  results[index]?.status === 'fulfilled' ? results[index].value : fallback
);

async function loadClassBundle(teacherId, scope, signal) {
  const results = await Promise.allSettled([
    tutorSessionApi.listTeacherSummaries(teacherId, scope.courseId, scope.classId, { signal }),
    tutorSessionApi.listTeacherSessions(teacherId, scope.courseId, scope.classId, { signal }),
    tutorSessionApi.listDirectives(teacherId, scope.courseId, scope.classId, { signal }),
    teacherApi.getClassStudents(scope.courseId, scope.classId, teacherId, { signal }),
    teacherApi.getCourseMemories(scope.courseId, scope.classId, { signal }),
  ]);
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  if (results.every((result) => result.status === 'rejected')) {
    throw results[0].reason || new Error('Không thể tải dữ liệu lớp.');
  }
  const roster = asArray(settledValue(results, 3, {}), 'students', 'items', 'content');
  return {
    students: buildClassStudentRows({
      roster,
      memories: asArray(settledValue(results, 4, {}), 'memories', 'items', 'content'),
      sessions: asArray(settledValue(results, 1, {}), 'sessions', 'items', 'content')
        .map((item) => mergeRosterIdentity(item, roster)),
      summaries: asArray(settledValue(results, 0, {}), 'summaries', 'items', 'content')
        .map((item) => mergeRosterIdentity(item, roster)),
      courseId: scope.courseId,
      classId: scope.classId,
      classLabel: scope.label,
    }),
    directives: asArray(settledValue(results, 2, {}), 'directives', 'items', 'content').map((item) => ({
      ...mergeRosterIdentity(item, roster),
      courseId: scope.courseId,
      classId: scope.classId,
      classKey: scope.key,
      classLabel: scope.label,
    })),
  };
}

export default function TeacherTutoringPage({
  teacherId,
  courseId,
  classId,
  setCourseId,
  setClassId,
  triggerToast,
}) {
  const queryClient = useQueryClient();
  const [activeClassKey, setActiveClassKey] = useState('ALL');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({
    classKey: '',
    studentId: '',
    instruction: '',
    supportLevel: 'STANDARD',
  });

  const classesQuery = useQuery({
    queryKey: queryKeys.teacherClasses(teacherId),
    queryFn: async ({ signal }) => asArray(
      await teacherApi.getClassSections(teacherId, { signal }),
      'classes',
      'classSections',
      'content',
    ),
    enabled: Boolean(teacherId),
    staleTime: 60_000,
  });
  const classScopes = useMemo(() => uniqueClassScopes(
    classesQuery.data || EMPTY_LIST,
    { courseId, classId },
  ), [classId, classesQuery.data, courseId]);
  const scopeKeys = useMemo(() => classScopes.map((scope) => scope.key), [classScopes]);
  const tutoringQueryKey = queryKeys.teacherTutoringBundle(teacherId, scopeKeys);
  const tutoringQuery = useQuery({
    queryKey: tutoringQueryKey,
    queryFn: async ({ signal }) => {
      const bundles = await Promise.all(
        classScopes.map((scope) => loadClassBundle(teacherId, scope, signal)),
      );
      return {
        students: bundles.flatMap((bundle) => bundle.students),
        directives: bundles.flatMap((bundle) => bundle.directives),
      };
    },
    enabled: Boolean(teacherId && classScopes.length),
    staleTime: 30_000,
  });
  const studentRows = tutoringQuery.data?.students || EMPTY_LIST;
  const directives = tutoringQuery.data?.directives || EMPTY_LIST;
  const loading = Boolean(teacherId)
    && (classesQuery.isPending || classesQuery.isFetching
      || (classScopes.length > 0 && (tutoringQuery.isPending || tutoringQuery.isFetching)));
  const effectiveActiveClassKey = useMemo(() => {
    if (activeClassKey === 'ALL' && classScopes.length > 1) return 'ALL';
    if (classScopes.some((scope) => scope.key === activeClassKey)) return activeClassKey;
    const preferred = classScopes.find((scope) => (
      String(scope.courseId).toUpperCase() === String(courseId || '').toUpperCase()
      && String(scope.classId).toUpperCase() === String(classId || '').toUpperCase()
    ));
    return preferred?.key || (classScopes.length === 1 ? classScopes[0].key : 'ALL');
  }, [activeClassKey, classId, classScopes, courseId]);

  useEffect(() => {
    const error = classesQuery.error || tutoringQuery.error;
    if (!error) return;
    triggerToast?.(getUserFacingError(error, 'Không thể tải dữ liệu gia sư của lớp.'));
  }, [classesQuery.error, triggerToast, tutoringQuery.error]);

  const transcriptKind = selectedSummary?._transcriptKind || '';
  const transcriptId = selectedSummary?.id || '';
  const transcriptQuery = useQuery({
    queryKey: queryKeys.teacherTutorTranscript(teacherId, transcriptKind, transcriptId),
    queryFn: async ({ signal }) => {
      const data = transcriptKind === 'session'
        ? await tutorSessionApi.getSessionTranscript(teacherId, transcriptId, { signal })
        : await tutorSessionApi.getTranscript(teacherId, transcriptId, { signal });
      return asArray(data, 'messages', 'content', 'items');
    },
    enabled: Boolean(teacherId && transcriptKind && transcriptId),
    staleTime: 60_000,
  });
  const transcript = transcriptQuery.data || EMPTY_LIST;

  useEffect(() => {
    if (!transcriptQuery.error) return;
    triggerToast?.(getUserFacingError(transcriptQuery.error, 'Không thể tải toàn bộ hội thoại.'));
  }, [transcriptQuery.error, triggerToast]);

  const scopedRows = useMemo(() => {
    if (effectiveActiveClassKey === 'ALL') return studentRows;
    return studentRows.filter((student) => student.classKey === effectiveActiveClassKey);
  }, [effectiveActiveClassKey, studentRows]);

  const visibleGroups = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const rows = keyword
      ? scopedRows.filter((student) => studentSearchText(student).includes(keyword))
      : scopedRows;
    return groupRowsByClass(rows);
  }, [query, scopedRows]);

  const visibleDirectives = useMemo(() => {
    const confirmed = directives.filter((item) => item.status === 'CONFIRMED');
    if (effectiveActiveClassKey === 'ALL') return confirmed;
    return confirmed.filter((item) => item.classKey === effectiveActiveClassKey);
  }, [directives, effectiveActiveClassKey]);

  const formStudents = useMemo(() => {
    const key = form.classKey || (effectiveActiveClassKey === 'ALL' ? '' : effectiveActiveClassKey);
    if (!key) return studentRows;
    return studentRows.filter((student) => student.classKey === key);
  }, [effectiveActiveClassKey, form.classKey, studentRows]);

  const studiedCount = scopedRows.filter((student) => student.hasActivity).length;
  const weakCount = scopedRows.filter((student) => student.weakTopics.length > 0).length;
  const activeScope = classScopes.find((scope) => scope.key === effectiveActiveClassKey)
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
    setForm((value) => ({
      ...value,
      classKey: student.classKey || value.classKey,
      studentId: student.studentId || '',
    }));
  };

  const openTranscript = (summary) => {
    setSelectedSummary({ ...summary, _transcriptKind: 'summary' });
  };

  const openSessionTranscript = (session) => {
    setSelectedSummary({
      ...session,
      topic: session.topic || 'Học tự do',
      _transcriptKind: 'session',
    });
  };

  const closeTranscript = () => {
    setSelectedSummary(null);
  };

  const applyDirectiveToStudent = (student) => {
    setForm((value) => ({
      ...value,
      classKey: student.classKey || value.classKey,
      studentId: student.studentId || '',
    }));
    if (student.classKey) setActiveClassKey(student.classKey);
    window.document.querySelector('.teacher-directive-form textarea')?.focus();
  };

  const createDirective = async (event) => {
    event.preventDefault();
    if (!form.instruction.trim()) return;
    const selectedStudentScope = studentRows.find((student) => student.studentId === form.studentId);
    const scope = classScopes.find((item) => item.key === (
      form.classKey || selectedStudentScope?.classKey || effectiveActiveClassKey
    ))
      || activeScope;
    if (!scope?.courseId || !scope?.classId) {
      triggerToast?.('Hãy chọn lớp trước khi gửi chỉ dẫn.');
      return;
    }
    setSaving(true);
    try {
      const draft = await tutorSessionApi.createDirective(teacherId, {
        studentId: form.studentId.trim() || null,
        topic: null,
        instruction: form.instruction.trim(),
        supportLevel: form.supportLevel,
        courseId: scope.courseId,
        classId: scope.classId,
      });
      await tutorSessionApi.confirmDirective(teacherId, draft.id);
      setForm({ classKey: form.classKey || scope.key, studentId: '', instruction: '', supportLevel: 'STANDARD' });
      triggerToast?.('Đã xác nhận chỉ dẫn. AI Tutor sẽ áp dụng từ lượt học tiếp theo.');
      await queryClient.invalidateQueries({ queryKey: tutoringQueryKey, exact: true });
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thể lưu chỉ dẫn sư phạm.'));
    } finally {
      setSaving(false);
    }
  };

  const archiveDirective = async (directiveId) => {
    try {
      await tutorSessionApi.archiveDirective(teacherId, directiveId);
      await queryClient.invalidateQueries({ queryKey: tutoringQueryKey, exact: true });
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
                  value={form.classKey || (effectiveActiveClassKey === 'ALL' ? '' : effectiveActiveClassKey)}
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
              <span>Nhận xét / chỉ dẫn cho toàn môn</span>
              <textarea
                value={form.instruction}
                onChange={(event) => setForm((value) => ({ ...value, instruction: event.target.value }))}
                placeholder="Ví dụ: Giải thích chậm hơn, dùng ví dụ đơn giản và thường xuyên kiểm tra mức độ hiểu của sinh viên."
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
                ? `${classScopes.length} lớp phụ trách · ${scopedRows.length} sinh viên${effectiveActiveClassKey === 'ALL' ? '' : ` · ${activeScope?.label || ''}`}`
                : `${activeScope?.label || 'Lớp hiện tại'} · ${scopedRows.length} sinh viên`}
              . Bấm một thẻ để xem bài đã học.
            </p>
            {classScopes.length > 0 && (
              <div className="teacher-class-tabs" role="tablist" aria-label="Lọc theo lớp">
                {classScopes.length > 1 && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={effectiveActiveClassKey === 'ALL'}
                    className={effectiveActiveClassKey === 'ALL' ? 'is-active' : ''}
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
                    aria-selected={effectiveActiveClassKey === scope.key}
                    className={effectiveActiveClassKey === scope.key ? 'is-active' : ''}
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
                        onClick={() => applyDirectiveToStudent(student)}
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
            {transcriptQuery.isPending ? (
              <p className="teacher-transcript__empty">Đang tải hội thoại...</p>
            ) : transcript.length === 0 ? (
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

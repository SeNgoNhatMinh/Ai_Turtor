import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Drawer, Empty, Input, Select, Spin, Tag } from "antd";
import { ArrowRight, BookOpenCheck, GraduationCap, MessageSquareText, Search, Send, TriangleAlert, Users } from "lucide-react";
import { queryKeys } from "../../../app/queryKeys";
import PageHeader from "../../../components/common/PageHeader";
import { getUserFacingError } from "../../../services/apiClient";
import { asArray } from "../../../services/normalizers";
import { teacherApi } from "../../../services/teacherApi";
import { tutorSessionApi } from "../../../services/tutorSessionApi";
import { getPersonEmail } from "../../../utils/displayNames";
import {
  buildClassStudentRows,
  formatTeacherStudentLabel,
  formatTutorWhen,
  groupRowsByClass,
  mergeRosterIdentity,
  sessionHeadline,
  sessionStatusLabel,
  studentInitials,
  supportLevelLabel,
  uniqueClassScopes,
} from "./teacherTutoringStudents";
import TeacherTranscriptThread from "./TeacherTranscriptThread";
import "./TeacherTutoringPage.css";

function TopicList({ label, items, tone = "default", wrap = false }) {
  if (!items?.length) return null;
  return (
    <div className={`teacher-topic-list${tone === "weak" ? " is-weak" : ""}${wrap ? " is-wrap" : ""}`}>
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

// Keep long lists bounded so the page stays usable with tens of thousands
// of students: the applied-directives panel lives in a fixed-height scroll
// box (rendered in batches) so it can never stretch the page, and the
// all-classes overview only previews a few students per class.
const DIRECTIVE_BATCH_SIZE = 20;

// Deterministic accent colour per course so class cards are easy to scan.
const CLASS_ACCENTS = ["#2563eb", "#ea580c", "#059669", "#7c3aed", "#0891b2", "#db2777"];
function classAccent(courseId) {
  const text = String(courseId || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 997;
  }
  return CLASS_ACCENTS[hash % CLASS_ACCENTS.length];
}

const settledValue = (results, index, fallback) =>
  results[index]?.status === "fulfilled" ? results[index].value : fallback;

async function loadClassBundle(teacherId, scope, signal, page = 0, size = 50, query = "") {
  const results = await Promise.allSettled([
    tutorSessionApi.listTeacherSummaries(teacherId, scope.courseId, scope.classId, { signal }),
    tutorSessionApi.listTeacherSessions(teacherId, scope.courseId, scope.classId, { signal }),
    tutorSessionApi.listDirectives(teacherId, scope.courseId, scope.classId, { signal }),
    teacherApi.getClassStudents(scope.courseId, scope.classId, teacherId, { signal, page, size, query }),
    teacherApi.getCourseMemories(scope.courseId, scope.classId, { signal }),
  ]);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (results.every((result) => result.status === "rejected")) {
    throw results[0].reason || new Error("Không thể tải dữ liệu lớp.");
  }
  const rosterResponse = settledValue(results, 3, {});
  const roster = asArray(rosterResponse, "students", "items", "content");
  return {
    rosterMeta: {
      totalElements: Number(rosterResponse?.totalElements ?? rosterResponse?.count ?? roster.length),
      totalPages: Number(rosterResponse?.totalPages ?? 1),
      page: Number(rosterResponse?.page ?? page),
      size: Number(rosterResponse?.size ?? size),
    },
    students: buildClassStudentRows({
      roster,
      memories: asArray(settledValue(results, 4, {}), "memories", "items", "content"),
      sessions: asArray(settledValue(results, 1, {}), "sessions", "items", "content").map((item) =>
        mergeRosterIdentity(item, roster),
      ),
      summaries: asArray(settledValue(results, 0, {}), "summaries", "items", "content").map((item) =>
        mergeRosterIdentity(item, roster),
      ),
      courseId: scope.courseId,
      classId: scope.classId,
      classLabel: scope.label,
    }),
    directives: asArray(settledValue(results, 2, {}), "directives", "items", "content").map((item) => ({
      ...mergeRosterIdentity(item, roster),
      courseId: scope.courseId,
      classId: scope.classId,
      classKey: scope.key,
      classLabel: scope.label,
    })),
  };
}

export default function TeacherTutoringPage({ teacherId, setCourseId, setClassId, triggerToast }) {
  const queryClient = useQueryClient();
  const [activeClassKey, setActiveClassKey] = useState("");
  const [studentPage, setStudentPage] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [classQuery, setClassQuery] = useState("");
  const [directiveQuery, setDirectiveQuery] = useState("");
  const [directiveVisibleCount, setDirectiveVisibleCount] = useState(DIRECTIVE_BATCH_SIZE);
  const [expandedDirectiveIds, setExpandedDirectiveIds] = useState(() => new Set());
  const [form, setForm] = useState({
    classKey: "",
    studentId: "",
    instruction: "",
    supportLevel: "STANDARD",
  });

  const classesQuery = useQuery({
    queryKey: queryKeys.teacherClasses(teacherId),
    queryFn: async ({ signal }) =>
      asArray(await teacherApi.getClassSections(teacherId, { signal }), "classes", "classSections", "content"),
    enabled: Boolean(teacherId),
    staleTime: 60_000,
  });
  const classScopes = useMemo(() => uniqueClassScopes(classesQuery.data || EMPTY_LIST), [classesQuery.data]);
  const effectiveActiveClassKey = useMemo(() => {
    if (classScopes.some((scope) => scope.key === activeClassKey)) return activeClassKey;
    return "";
  }, [activeClassKey, classScopes]);
  const activeScope = classScopes.find((scope) => scope.key === effectiveActiveClassKey);
  const scopeKeys = useMemo(
    () => (activeScope ? [activeScope.key, studentPage, debouncedQuery] : []),
    [activeScope, debouncedQuery, studentPage],
  );
  const tutoringQueryKey = queryKeys.teacherTutoringBundle(teacherId, scopeKeys);
  const tutoringQuery = useQuery({
    queryKey: tutoringQueryKey,
    queryFn: async ({ signal }) => {
      return loadClassBundle(teacherId, activeScope, signal, studentPage, 50, debouncedQuery);
    },
    enabled: Boolean(teacherId && activeScope),
    staleTime: 30_000,
  });
  const studentRows = tutoringQuery.data?.students || EMPTY_LIST;
  const directives = tutoringQuery.data?.directives || EMPTY_LIST;

  // "Tất cả lớp" overview: teachers first see the classes they teach and
  // only open one class to reveal its students. The overview therefore
  // loads just a lightweight student count per class, never the rosters.
  const overviewQueries = useQueries({
    queries: classScopes.map((scope) => ({
      queryKey: ["teacher", "tutoring", "class-student-count", teacherId, scope.key],
      queryFn: async ({ signal }) =>
        teacherApi.getClassStudents(scope.courseId, scope.classId, teacherId, { signal, page: 0, size: 1 }),
      enabled: Boolean(teacherId && !activeScope),
      staleTime: 60_000,
    })),
  });
  const overviewBundles = classScopes.map((scope, index) => ({
    scope,
    query: overviewQueries[index],
    total: Number(
      overviewQueries[index]?.data?.totalElements ?? overviewQueries[index]?.data?.count ?? 0,
    ),
  }));
  const overviewTotalStudents = overviewBundles.reduce((sum, item) => sum + item.total, 0);
  const filteredOverviewBundles = useMemo(() => {
    const keyword = classQuery.trim().toLowerCase();
    if (!keyword) return overviewBundles;
    return overviewBundles.filter(({ scope }) =>
      [scope.courseId, scope.classId, scope.className, scope.label]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)));
  }, [classQuery, overviewBundles]);
  const overviewLoading = Boolean(teacherId && !activeScope
    && overviewQueries.some((query) => query?.isPending || query?.isFetching));
  const loading =
    Boolean(teacherId) &&
    (classesQuery.isPending ||
      classesQuery.isFetching ||
      (Boolean(activeScope) && (tutoringQuery.isPending || tutoringQuery.isFetching)));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setStudentPage(0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const error = classesQuery.error || tutoringQuery.error;
    if (!error) return;
    triggerToast?.(getUserFacingError(error, "Không thể tải dữ liệu gia sư của lớp."));
  }, [classesQuery.error, triggerToast, tutoringQuery.error]);

  const transcriptKind = selectedSummary?._transcriptKind || "";
  const transcriptId = selectedSummary?.id || "";
  const transcriptQuery = useQuery({
    queryKey: queryKeys.teacherTutorTranscript(teacherId, transcriptKind, transcriptId),
    queryFn: async ({ signal }) => {
      const data =
        transcriptKind === "session"
          ? await tutorSessionApi.getSessionTranscript(teacherId, transcriptId, { signal })
          : await tutorSessionApi.getTranscript(teacherId, transcriptId, { signal });
      return asArray(data, "messages", "content", "items");
    },
    enabled: Boolean(teacherId && transcriptKind && transcriptId),
    staleTime: 60_000,
  });
  const transcript = transcriptQuery.data || EMPTY_LIST;

  useEffect(() => {
    if (!transcriptQuery.error) return;
    triggerToast?.(getUserFacingError(transcriptQuery.error, "Không thể tải toàn bộ hội thoại."));
  }, [transcriptQuery.error, triggerToast]);

  const scopedRows = studentRows;
  const visibleGroups = useMemo(() => groupRowsByClass(scopedRows), [scopedRows]);

  const visibleDirectives = useMemo(() => {
    const confirmed = directives.filter((item) => item.status === "CONFIRMED");
    return confirmed.filter((item) => item.classKey === effectiveActiveClassKey);
  }, [directives, effectiveActiveClassKey]);

  const filteredDirectives = useMemo(() => {
    const keyword = directiveQuery.trim().toLowerCase();
    if (!keyword) return visibleDirectives;
    return visibleDirectives.filter((item) => {
      const owner = item.studentId ? formatTeacherStudentLabel(item, "") : "Cả lớp";
      return owner.toLowerCase().includes(keyword)
        || String(item.instruction || "").toLowerCase().includes(keyword);
    });
  }, [directiveQuery, visibleDirectives]);
  const renderedDirectives = filteredDirectives.slice(0, directiveVisibleCount);

  useEffect(() => {
    setDirectiveVisibleCount(DIRECTIVE_BATCH_SIZE);
  }, [directiveQuery, effectiveActiveClassKey]);

  const toggleDirectiveExpanded = (directiveId) => {
    setExpandedDirectiveIds((current) => {
      const next = new Set(current);
      if (next.has(directiveId)) next.delete(directiveId);
      else next.add(directiveId);
      return next;
    });
  };

  const formStudents = useMemo(() => {
    const key = form.classKey || effectiveActiveClassKey;
    if (!key) return studentRows;
    return studentRows.filter((student) => student.classKey === key);
  }, [effectiveActiveClassKey, form.classKey, studentRows]);

  const studiedCount = scopedRows.filter((student) => student.hasActivity).length;
  const weakCount = scopedRows.filter((student) => student.weakTopics.length > 0).length;
  const selectClass = (key) => {
    setActiveClassKey(key);
    setStudentPage(0);
    setQuery("");
    setSelectedStudent(null);
    closeTranscript();
    const scope = classScopes.find((item) => item.key === key);
    if (scope) {
      setCourseId?.(scope.courseId);
      setClassId?.(scope.classId);
    }
    setForm((value) => ({
      ...value,
      classKey: key,
      studentId: "",
    }));
  };

  const openStudent = (student) => {
    setSelectedStudent(student);
    setSelectedSummary(null);
    setForm((value) => ({
      ...value,
      classKey: student.classKey || value.classKey,
      studentId: student.studentId || "",
    }));
  };

  const openTranscript = (summary) => {
    setSelectedSummary({ ...summary, _transcriptKind: "summary" });
  };

  const openSessionTranscript = (session) => {
    setSelectedSummary({
      ...session,
      topic: session.topic || "Học tự do",
      _transcriptKind: "session",
    });
  };

  const closeTranscript = () => {
    setSelectedSummary(null);
  };

  const applyDirectiveToStudent = (student) => {
    setForm((value) => ({
      ...value,
      classKey: student.classKey || value.classKey,
      studentId: student.studentId || "",
    }));
    if (student.classKey) setActiveClassKey(student.classKey);
    window.document.querySelector(".teacher-directive-form textarea")?.focus();
  };

  const createDirective = async (event) => {
    event.preventDefault();
    if (!form.instruction.trim()) return;
    const selectedStudentScope = studentRows.find((student) => student.studentId === form.studentId);
    const scope =
      classScopes.find(
        (item) => item.key === (form.classKey || selectedStudentScope?.classKey || effectiveActiveClassKey),
      ) || activeScope;
    if (!scope?.courseId || !scope?.classId) {
      triggerToast?.("Hãy chọn lớp trước khi gửi chỉ dẫn.");
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
      setForm({ classKey: form.classKey || scope.key, studentId: "", instruction: "", supportLevel: "STANDARD" });
      triggerToast?.("Đã xác nhận chỉ dẫn. AI Tutor sẽ áp dụng từ lượt học tiếp theo.");
      await queryClient.invalidateQueries({ queryKey: tutoringQueryKey, exact: true });
    } catch (error) {
      triggerToast?.(getUserFacingError(error, "Không thể lưu chỉ dẫn sư phạm."));
    } finally {
      setSaving(false);
    }
  };

  const archiveDirective = async (directiveId) => {
    try {
      await tutorSessionApi.archiveDirective(teacherId, directiveId);
      await queryClient.invalidateQueries({ queryKey: tutoringQueryKey, exact: true });
    } catch (error) {
      triggerToast?.(getUserFacingError(error, "Không thể ngừng áp dụng chỉ dẫn."));
    }
  };


  const renderStudentRow = (student) => {
    const chatCount = student.sessions.length + student.summaries.length;
    return (
      <article key={`${student.classKey}-${student.studentId || student.id}`} className="tt-student">
        <div className="tt-student__main">
          <span className="tt-avatar">{studentInitials(student)}</span>
          <div className="tt-student__copy">
            <div className="tt-student__name-row">
              <strong>{formatTeacherStudentLabel(student)}</strong>
              {student.hasActivity
                ? <Tag color="success">Đã học với AI</Tag>
                : <Tag>Chưa học</Tag>}
            </div>
            <span className="tt-student__email">{getPersonEmail(student) || "Chưa có email"}</span>
            <span className="tt-student__activity">{student.activityLabel}</span>
            {(student.studiedTopics?.length > 0 || student.weakTopics?.length > 0) && (
              <div className="tt-student__topics">
                {student.studiedTopics?.slice(0, 4).map((topic) => (
                  <span key={`ok-${topic}`} className="tt-chip">{topic}</span>
                ))}
                {student.studiedTopics?.length > 4 && (
                  <span className="tt-chip tt-chip--more">+{student.studiedTopics.length - 4}</span>
                )}
                {student.weakTopics?.slice(0, 3).map((topic) => (
                  <span key={`weak-${topic}`} className="tt-chip tt-chip--weak">{topic}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="tt-student__actions">
          <Button
            type="primary"
            size="small"
            icon={<MessageSquareText size={13} />}
            onClick={() => openStudent(student)}
          >
            Xem {chatCount} đoạn chat
          </Button>
          <Button size="small" icon={<Send size={13} />} onClick={() => applyDirectiveToStudent(student)}>
            Gửi chỉ dẫn
          </Button>
        </div>
      </article>
    );
  };

  const selectedStudentLabel = formatTeacherStudentLabel(selectedStudent || selectedSummary, "sinh viên");

  return (
    <div className="portal-section teacher-tutoring-page">
      <PageHeader
        eyebrow="AI Tutor"
        title="Theo dõi AI Tutor theo từng lớp"
        description="Chọn lớp bạn phụ trách, xem bài đã học của từng sinh viên và gửi chỉ dẫn sư phạm cho AI Tutor."
        actions={
          <div className="teacher-tutoring-stats">
            <div>
              <strong>{classScopes.length}</strong>
              <span>Lớp</span>
            </div>
            <div>
              <strong>
                {activeScope ? (tutoringQuery.data?.rosterMeta?.totalElements ?? scopedRows.length) : overviewTotalStudents}
              </strong>
              <span>Sinh viên</span>
            </div>
            {activeScope && (
              <>
                <div>
                  <strong>{studiedCount}</strong>
                  <span>Đã học · trang hiện tại</span>
                </div>
                <div>
                  <strong>{weakCount}</strong>
                  <span>Cần củng cố · trang hiện tại</span>
                </div>
              </>
            )}
          </div>
        }
      />

      <Card className="tt-toolbar" variant="borderless">
        <div className="tt-toolbar__row">
          {activeScope ? (
            <>
              <label className="tt-field tt-field--class">
                <span><GraduationCap size={14} /> Lớp học của bạn</span>
                <Select
                  value={effectiveActiveClassKey || undefined}
                  placeholder="Chọn lớp để xem sinh viên"
                  loading={classesQuery.isFetching}
                  options={classScopes.map((scope) => ({ value: scope.key, label: scope.label }))}
                  onChange={(key) => selectClass(key)}
                />
              </label>
              <label className="tt-field tt-field--search">
                <span><Search size={14} /> Tìm sinh viên</span>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm theo tên, mã sinh viên hoặc email"
                  aria-label="Tìm sinh viên"
                  allowClear
                />
              </label>
              <div className="tt-toolbar__meta">
                <strong>{tutoringQuery.data?.rosterMeta?.totalElements ?? scopedRows.length} sinh viên</strong>
                <span>trong {activeScope.label} · chọn sinh viên để xem đoạn chat và gửi chỉ dẫn</span>
              </div>
            </>
          ) : (
            <>
              <label className="tt-field tt-field--search">
                <span><Search size={14} /> Tìm lớp</span>
                <Input
                  value={classQuery}
                  onChange={(event) => setClassQuery(event.target.value)}
                  placeholder="Tìm theo mã môn hoặc mã lớp"
                  aria-label="Tìm lớp"
                  allowClear
                />
              </label>
              <div className="tt-toolbar__meta">
                <strong>{classScopes.length} lớp · {overviewTotalStudents} sinh viên</strong>
                <span>bạn được phân công đứng lớp · chọn một lớp ở bên dưới để xem chi tiết</span>
              </div>
            </>
          )}
        </div>
      </Card>

      {loading && classScopes.length === 0 && (
        <Card className="tt-state" variant="borderless"><Spin /> <span>Đang tải danh sách lớp...</span></Card>
      )}
      {!loading && classScopes.length === 0 && (
        <Card className="tt-state" variant="borderless">
          <Empty description="Bạn chưa được phân công lớp nào. Liên hệ quản trị viên để được gán lớp học phần." />
        </Card>
      )}

      {!activeScope && classScopes.length > 0 && (
        <div className="tt-overview">
          <div className="tt-overview__head">
            <h2>Các lớp bạn đang đứng lớp</h2>
            <p>
              {classScopes.length} lớp · {overviewTotalStudents} sinh viên.
              Chọn một lớp để xem danh sách sinh viên, đoạn chat và chỉ dẫn đang áp dụng.
            </p>
          </div>
          {filteredOverviewBundles.length === 0 ? (
            <Empty description="Không tìm thấy lớp nào khớp với từ khóa." />
          ) : (
            <div className="tt-class-grid">
              {filteredOverviewBundles.map(({ scope, query, total }) => (
                <Card
                key={scope.key}
                className="tt-class-section tt-class-card"
                variant="borderless"
                style={{ "--class-accent": classAccent(scope.courseId) }}
              >
                  <button
                    type="button"
                    className="tt-class-card__button"
                    aria-label={`Mở lớp ${scope.label}`}
                    onClick={() => selectClass(scope.key)}
                  >
                    <span className="tt-class-card__top">
                      <span className="tt-class-card__icon"><GraduationCap size={20} /></span>
                      <span className="tt-class-card__open">
                        Mở lớp <ArrowRight size={14} />
                      </span>
                    </span>
                    <span className="tt-class-card__course-line">
                      <span className="tt-class-section__course">{scope.courseId}</span>
                      <span className="tt-class-card__meta">
                        <Users size={14} />
                        {query?.isPending || query?.isFetching
                          ? "Đang đếm sinh viên…"
                          : total > 0
                            ? `${total} sinh viên`
                            : "Chưa có sinh viên ghi danh"}
                      </span>
                    </span>
                    <strong className="tt-class-card__name">{scope.className || scope.classId}</strong>
                    <span className="tt-class-card__features">
                      <span><Users size={12} /> Sinh viên</span>
                      <span><MessageSquareText size={12} /> Đoạn chat</span>
                      <span><BookOpenCheck size={12} /> Chỉ dẫn AI</span>
                    </span>
                  </button>
                </Card>
              ))}
            </div>
          )}
          {overviewLoading && (
            <p className="tt-overview__loading">Đang tải số sinh viên của các lớp...</p>
          )}
        </div>
      )}

      {activeScope && (
        <div className="tt-layout">
          <Card
            className="tt-roster"
            variant="borderless"
            title={(
              <span className="tt-card-title">
                <Users size={16} /> Danh sách sinh viên
                <Tag color="blue">{tutoringQuery.data?.rosterMeta?.totalElements ?? scopedRows.length}</Tag>
              </span>
            )}
            extra={(
              <Button size="small" onClick={() => selectClass("")}>← Tất cả lớp</Button>
            )}
          >
            {loading && <div className="tt-state"><Spin /> <span>Đang tải sinh viên...</span></div>}
            {!loading && scopedRows.length === 0 && (
              <Empty description="Lớp này chưa có sinh viên được ghi danh." />
            )}
            {!loading && scopedRows.length > 0 && visibleGroups.length === 0 && (
              <Empty description="Không tìm thấy sinh viên khớp với từ khóa." />
            )}
            {!loading && visibleGroups.map((group) => (
              <div key={group.key} className="tt-student-list">
                {group.students.map((student) => renderStudentRow(student))}
              </div>
            ))}
            {tutoringQuery.data?.rosterMeta?.totalPages > 1 && (
              <nav className="tt-pagination" aria-label="Phân trang sinh viên">
                <span>Trang {studentPage + 1} / {tutoringQuery.data.rosterMeta.totalPages}</span>
                <div>
                  <Button size="small" disabled={studentPage === 0 || loading} onClick={() => setStudentPage((page) => page - 1)}>
                    Trước
                  </Button>
                  <Button
                    size="small"
                    disabled={studentPage + 1 >= tutoringQuery.data.rosterMeta.totalPages || loading}
                    onClick={() => setStudentPage((page) => page + 1)}
                  >
                    Tiếp
                  </Button>
                </div>
              </nav>
            )}
          </Card>

          <div className="tt-side">
            <Card
              className="tt-directive"
              variant="borderless"
              title={(
                <span className="tt-card-title">
                  <BookOpenCheck size={16} /> Chỉ dẫn sư phạm cho AI Tutor
                </span>
              )}
            >
              <form className="teacher-directive-form tt-form" onSubmit={createDirective}>
                <label className="tt-field">
                  <span>Lớp áp dụng</span>
                  <Select
                    value={form.classKey || effectiveActiveClassKey || undefined}
                    placeholder="Chọn lớp"
                    options={classScopes.map((scope) => ({ value: scope.key, label: scope.label }))}
                    onChange={(key) => setForm((value) => ({ ...value, classKey: key, studentId: "" }))}
                  />
                </label>
                <label className="tt-field">
                  <span>Sinh viên</span>
                  <Select
                    value={form.studentId || ""}
                    showSearch
                    optionFilterProp="label"
                    placeholder="Chọn sinh viên (gõ để tìm trong danh sách đã tải)"
                    options={[
                      { value: "", label: "Cả lớp" },
                      ...formStudents.map((student) => ({
                        value: student.studentId || "",
                        label: classScopes.length > 1
                          ? `${student.classId} · ${formatTeacherStudentLabel(student)}`
                          : formatTeacherStudentLabel(student),
                      })),
                    ]}
                    onChange={(value) => setForm((current) => ({ ...current, studentId: value }))}
                  />
                </label>
                <label className="tt-field">
                  <span>Mức hỗ trợ</span>
                  <Select
                    value={form.supportLevel}
                    options={[
                      { value: "HIGH_SUPPORT", label: "Hướng dẫn kỹ, từng bước" },
                      { value: "STANDARD", label: "Cân bằng giải thích và thực hành" },
                      { value: "CHALLENGE", label: "Tăng thử thách, giảm gợi ý" },
                    ]}
                    onChange={(value) => setForm((current) => ({ ...current, supportLevel: value }))}
                  />
                </label>
                <label className="tt-field">
                  <span>Nhận xét / chỉ dẫn cho AI Tutor</span>
                  <Input.TextArea
                    value={form.instruction}
                    onChange={(event) => setForm((value) => ({ ...value, instruction: event.target.value }))}
                    placeholder="Ví dụ: Giải thích từng bước, dùng ví dụ gần thực tế, nhắc lại thuật ngữ quan trọng và kiểm tra mức độ hiểu sau mỗi phần."
                    rows={4}
                    required
                  />
                  <small className="tt-field__hint">
                    Định hướng cách giải thích, ví dụ, độ khó và cách kiểm tra hiểu; AI vẫn ưu tiên syllabus và tài liệu chính thức của môn.
                  </small>
                </label>
                <Button type="primary" htmlType="submit" block loading={saving}>
                  Xác nhận và áp dụng
                </Button>
              </form>

              <div className="tt-directive-list">
                <div className="tt-directive-list__head">
                  <h3>Đang áp dụng tại lớp này</h3>
                  {visibleDirectives.length > 0 && <Tag color="blue">{visibleDirectives.length}</Tag>}
                </div>
                {visibleDirectives.length > 0 && (
                  <Input
                    className="tt-directive-search"
                    value={directiveQuery}
                    onChange={(event) => setDirectiveQuery(event.target.value)}
                    placeholder="Tìm chỉ dẫn theo sinh viên hoặc nội dung"
                    aria-label="Tìm chỉ dẫn đang áp dụng"
                    allowClear
                  />
                )}
                {visibleDirectives.length === 0 && (
                  <p className="tt-directive-empty">Chưa có chỉ dẫn nào đang áp dụng.</p>
                )}
                {visibleDirectives.length > 0 && filteredDirectives.length === 0 && (
                  <p className="tt-directive-empty">Không có chỉ dẫn nào khớp với từ khóa.</p>
                )}
                {renderedDirectives.length > 0 && (
                <div className="tt-directive-scroll">
                {renderedDirectives.map((item) => {
                  const isLongInstruction = String(item.instruction || "").length > 220;
                  const isExpanded = expandedDirectiveIds.has(item.id);
                  return (
                    <article key={item.id} className="tt-directive-item">
                      <div className="tt-directive-item__head">
                        <strong>
                          {item.classLabel ? `${item.classLabel} · ` : ""}
                          {item.studentId ? formatTeacherStudentLabel(item, "Sinh viên") : "Cả lớp"}
                        </strong>
                        <Tag color={item.supportLevel === "HIGH_SUPPORT" ? "orange" : item.supportLevel === "CHALLENGE" ? "purple" : "blue"}>
                          {supportLevelLabel(item.supportLevel)}
                        </Tag>
                      </div>
                      <p className={isLongInstruction && !isExpanded ? "tt-directive-item__clamp" : undefined}>
                        {item.instruction}
                      </p>
                      <div className="tt-directive-item__actions">
                        {isLongInstruction && (
                          <Button type="link" size="small" onClick={() => toggleDirectiveExpanded(item.id)}>
                            {isExpanded ? "Thu gọn" : "Xem đầy đủ"}
                          </Button>
                        )}
                        <Button danger size="small" onClick={() => archiveDirective(item.id)}>
                          Ngừng áp dụng
                        </Button>
                      </div>
                    </article>
                  );
                })}
                {filteredDirectives.length > renderedDirectives.length && (
                  <Button
                    block
                    onClick={() => setDirectiveVisibleCount((count) => count + DIRECTIVE_BATCH_SIZE)}
                  >
                    Hiển thị thêm (còn {filteredDirectives.length - renderedDirectives.length} chỉ dẫn)
                  </Button>
                )}
                </div>
                )}
              </div>
            </Card>

            <Card className="tt-side-note" variant="borderless">
              <div className="tt-side-note__row">
                <TriangleAlert size={15} />
                <p>
                  <strong>{weakCount} sinh viên cần củng cố</strong> ở trang hiện tại. Mở hồ sơ sinh viên để xem
                  chủ đề yếu, câu hỏi gần đây và toàn bộ đoạn chat trước khi gửi chỉ dẫn riêng.
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      <Drawer
        title={selectedSummary ? "Hội thoại" : "Bài đã học"}
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
                  {selectedStudent.classLabel ? `${selectedStudent.classLabel} · ` : ""}
                  {getPersonEmail(selectedStudent) || "Chưa có email"}
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
                          {" · "}
                          {session.studentTurnCount || 0} lượt
                          {formatTutorWhen(session.updatedAt || session.startedAt)
                            ? ` · ${formatTutorWhen(session.updatedAt || session.startedAt)}`
                            : ""}
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
                          {" · "}
                          {supportLevelLabel(summary.supportLevel)}
                          {formatTutorWhen(summary.createdAt || summary.sharedWithTeacherAt)
                            ? ` · ${formatTutorWhen(summary.createdAt || summary.sharedWithTeacherAt)}`
                            : ""}
                        </span>
                      </div>
                      {summary.summaryText ? <p>{summary.summaryText}</p> : null}
                      <button type="button" className="teacher-tutoring-btn" onClick={() => openTranscript(summary)}>
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

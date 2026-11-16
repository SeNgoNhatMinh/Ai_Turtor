import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Button, Card, Drawer, Empty, Input, Select, Skeleton, Tag } from "antd";
import { ArrowRight, GraduationCap, Lightbulb, MessageSquareText, Search, TriangleAlert, Users } from "lucide-react";
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
import AdaptiveLearningReviewPanel from "../review/AdaptiveLearningReviewPanel";
import StudentTeachingRagPanel from "../behaviors/StudentTeachingRagPanel";
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

// First page of the recent-chat drawer. "Hiển thị thêm" reveals the next page.
const RECENT_CHAT_LIMIT = 5;

function chatTimestamp(item) {
  return new Date(
    item?.updatedAt || item?.createdAt || item?.sharedWithTeacherAt || item?.startedAt || 0,
  ).getTime();
}

/** Sessions + teacher summaries, newest first — the "đoạn chat" list on the student card. */
function collectRecentChats(student) {
  const sessions = (student?.sessions || []).map((session) => ({
    ...session,
    _chatKind: "session",
    _chatAt: chatTimestamp(session),
  }));
  const summaries = (student?.summaries || []).map((summary) => ({
    ...summary,
    _chatKind: "summary",
    _chatAt: chatTimestamp(summary),
  }));
  return [...sessions, ...summaries].sort((left, right) => right._chatAt - left._chatAt);
}

function supportNeedScore(student) {
  return (student?.weakTopics?.length || 0) * 10 + (student?.hasActivity ? 1 : 0);
}

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
    teacherApi.getClassStudents(scope.courseId, scope.classId, teacherId, { signal, page, size, query }),
    teacherApi.getCourseMemories(scope.courseId, scope.classId, { signal }),
  ]);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (results.every((result) => result.status === "rejected")) {
    throw results[0].reason || new Error("Không thể tải dữ liệu lớp.");
  }
  const rosterResponse = settledValue(results, 2, {});
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
      memories: asArray(settledValue(results, 3, {}), "memories", "items", "content"),
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
  };
}

export default function TeacherTutoringPage({ teacherId, setCourseId, setClassId, triggerToast }) {
  const [activeClassKey, setActiveClassKey] = useState("");
  const [studentPage, setStudentPage] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [drawerFocus, setDrawerFocus] = useState("support");
  const [visibleChatCount, setVisibleChatCount] = useState(RECENT_CHAT_LIMIT);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [classQuery, setClassQuery] = useState("");

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
    triggerToast?.(getUserFacingError(error, "Không thể tải dữ liệu gia sư của lớp."), 'error');
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
    triggerToast?.(getUserFacingError(transcriptQuery.error, "Không thể tải toàn bộ hội thoại."), 'error');
  }, [transcriptQuery.error, triggerToast]);

  const scopedRows = useMemo(
    () => [...studentRows].sort((left, right) => {
      const byNeed = supportNeedScore(right) - supportNeedScore(left);
      if (byNeed !== 0) return byNeed;
      return formatTeacherStudentLabel(left).localeCompare(formatTeacherStudentLabel(right), "vi");
    }),
    [studentRows],
  );
  const visibleGroups = useMemo(() => groupRowsByClass(scopedRows), [scopedRows]);

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
  };

  const openStudent = (student, focus = "support") => {
    setSelectedStudent(student);
    setSelectedSummary(null);
    setDrawerFocus(focus);
    setVisibleChatCount(RECENT_CHAT_LIMIT);
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

  const renderStudentRow = (student) => {
    const chatCount = collectRecentChats(student).length;
    const recentChatLabel = chatCount === 0
      ? "Chưa có đoạn chat"
      : chatCount <= RECENT_CHAT_LIMIT
        ? `Xem ${chatCount} đoạn chat gần nhất`
        : `Xem ${RECENT_CHAT_LIMIT} đoạn chat gần nhất`;
    return (
      <article key={`${student.classKey}-${student.studentId || student.id}`} className="tt-student">
        <div className="tt-student__main">
          <span className="tt-avatar">{studentInitials(student)}</span>
          <div className="tt-student__copy">
            <div className="tt-student__name-row">
              <strong>{formatTeacherStudentLabel(student)}</strong>
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
            icon={<Lightbulb size={13} />}
            onClick={() => openStudent(student, "support")}
          >
            Xem gợi ý hỗ trợ
          </Button>
          <Button
            size="small"
            icon={<MessageSquareText size={13} />}
            disabled={chatCount === 0}
            onClick={() => openStudent(student, "chats")}
          >
            {recentChatLabel}
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
        description="Chọn lớp bạn phụ trách, xem gợi ý hỗ trợ và 5 đoạn chat gần nhất của từng sinh viên."
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
                <span>trong {activeScope.label} · chọn sinh viên để xem gợi ý hỗ trợ hoặc đoạn chat gần nhất</span>
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
        <Card className="tt-state" variant="borderless"><Skeleton active paragraph={{ rows: 3 }} /></Card>
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
              Chọn một lớp để xem danh sách sinh viên, gợi ý hỗ trợ và đoạn chat gần nhất.
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
                      <span><Lightbulb size={12} /> Gợi ý hỗ trợ</span>
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
        <div className="tt-layout tt-layout--single">
          {weakCount > 0 && (
            <Card className="tt-side-note" variant="borderless">
              <div className="tt-side-note__row">
                <TriangleAlert size={15} />
                <p>
                  <strong>{weakCount} sinh viên cần củng cố</strong> ở trang hiện tại (được xếp lên đầu danh sách).
                  Mở <em>Xem gợi ý hỗ trợ</em> hoặc <em>5 đoạn chat gần nhất</em> để xem chi tiết.
                </p>
              </div>
            </Card>
          )}
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
            {loading && <div className="tt-state"><Skeleton active avatar paragraph={{ rows: 2 }} /><Skeleton active avatar paragraph={{ rows: 2 }} /></div>}
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
        </div>
      )}

      <Drawer
        title={selectedSummary
          ? "Hội thoại"
          : drawerFocus === "chats"
            ? "Đoạn chat gần nhất"
            : "Gợi ý hỗ trợ"}
        width={760}
        className="teacher-transcript-drawer"
        rootClassName="teacher-transcript-drawer"
        open={Boolean(selectedStudent)}
        onClose={() => {
          setSelectedStudent(null);
          setDrawerFocus("support");
          setVisibleChatCount(RECENT_CHAT_LIMIT);
          closeTranscript();
        }}
      >
        {selectedStudent && !selectedSummary && (() => {
          const allChats = collectRecentChats(selectedStudent);
          const visibleChats = allChats.slice(0, visibleChatCount);
          const hiddenChatCount = allChats.length - visibleChats.length;
          const chatSection = (
            <section className="teacher-detail-section" id="teacher-recent-chats">
              <div className="teacher-detail-section__heading">
                <div>
                  <h3>Đoạn chat gần nhất ({allChats.length})</h3>
                  <p className="teacher-detail-section__hint">
                    {hiddenChatCount > 0
                      ? `Đang hiện ${visibleChats.length}/${allChats.length}.`
                      : "Buổi học và tổng kết gửi giảng viên, mới nhất trước."}
                  </p>
                </div>
              </div>
              {allChats.length === 0 ? (
                <p className="teacher-tutoring-empty">Sinh viên này chưa có đoạn chat với AI Tutor.</p>
              ) : (
                <div className="teacher-detail-stack">
                  {visibleChats.map((item) => (
                    <article key={`${item._chatKind}-${item.id}`} className="teacher-detail-item">
                      <div>
                        <strong>{sessionHeadline(item, selectedStudent.studiedTopics)}</strong>
                        <span>
                          {item._chatKind === "session"
                            ? sessionStatusLabel(item.status)
                            : "Tổng kết gửi giảng viên"}
                          {" · "}
                          {item.studentTurnCount || 0} lượt
                          {item._chatKind === "summary" ? ` · ${supportLevelLabel(item.supportLevel)}` : ""}
                          {formatTutorWhen(item.updatedAt || item.createdAt || item.sharedWithTeacherAt || item.startedAt)
                            ? ` · ${formatTutorWhen(item.updatedAt || item.createdAt || item.sharedWithTeacherAt || item.startedAt)}`
                            : ""}
                        </span>
                      </div>
                      {item._chatKind === "summary" && item.summaryText ? <p>{item.summaryText}</p> : null}
                      <button
                        type="button"
                        className="teacher-tutoring-btn"
                        onClick={() => (item._chatKind === "session"
                          ? openSessionTranscript(item)
                          : openTranscript(item))}
                      >
                        {item._chatKind === "session" ? "Xem hội thoại" : "Xem hội thoại đầy đủ"}
                      </button>
                    </article>
                  ))}
                  {hiddenChatCount > 0 && (
                    <Button
                      block
                      className="teacher-detail-more"
                      onClick={() => setVisibleChatCount((count) => count + RECENT_CHAT_LIMIT)}
                    >
                      Hiển thị thêm
                    </Button>
                  )}
                </div>
              )}
            </section>
          );
          const supportSections = (
            <>
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

              <section className="teacher-detail-section">
                <h3>Đánh giá tiến bộ của AI</h3>
                <AdaptiveLearningReviewPanel
                  embedded
                  forcedStudentId={selectedStudent.studentId || selectedStudent.id || ""}
                  courseId={selectedStudent.courseId || activeScope?.courseId || ""}
                  classId={selectedStudent.classId || activeScope?.classId || ""}
                  triggerToast={triggerToast}
                />
              </section>

              <section className="teacher-detail-section">
                <h3>Cách AI hỗ trợ bạn học</h3>
                <StudentTeachingRagPanel
                  studentId={selectedStudent.studentId || selectedStudent.id || ""}
                  courseId={selectedStudent.courseId || activeScope?.courseId || ""}
                  classId={selectedStudent.classId || activeScope?.classId || ""}
                  triggerToast={triggerToast}
                  masteredTopics={selectedStudent.studiedTopics || selectedStudent.learnedTopics || []}
                  improveTopics={selectedStudent.weakTopics || []}
                  recentResults={(selectedStudent.recentQuestions || []).map((question) => `Đã hỏi: ${question}`)}
                />
              </section>

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
            </>
          );

          return (
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

              <div className="teacher-detail-tabs">
                <Button
                  type={drawerFocus === "support" ? "primary" : "default"}
                  size="small"
                  icon={<Lightbulb size={13} />}
                  onClick={() => setDrawerFocus("support")}
                >
                  Gợi ý hỗ trợ
                </Button>
                <Button
                  type={drawerFocus === "chats" ? "primary" : "default"}
                  size="small"
                  icon={<MessageSquareText size={13} />}
                  onClick={() => setDrawerFocus("chats")}
                >
                  {allChats.length > RECENT_CHAT_LIMIT
                    ? `${RECENT_CHAT_LIMIT} đoạn chat gần nhất`
                    : "Đoạn chat gần nhất"}
                </Button>
              </div>

              {drawerFocus === "chats" ? chatSection : supportSections}
              {drawerFocus === "support" && allChats.length > 0 && (
                <div className="teacher-detail-section teacher-detail-section--jump">
                  <Button
                    block
                    icon={<MessageSquareText size={14} />}
                    onClick={() => setDrawerFocus("chats")}
                  >
                    {allChats.length > RECENT_CHAT_LIMIT
                      ? `Xem ${RECENT_CHAT_LIMIT} đoạn chat gần nhất`
                      : `Xem ${allChats.length} đoạn chat gần nhất`}
                  </Button>
                </div>
              )}
            </div>
          );
        })()}

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

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  CircleGauge,
  ClipboardCheck,
  FileCheck2,
  Flame,
  GraduationCap,
  Layers3,
  MessageCircle,
  Search,
  X,
} from 'lucide-react';
import { queryKeys } from '../../../app/queryKeys';
import { studentLearningApi } from '../../../services/studentLearningApi';
import { includesSearchText } from '../../../utils/searchText';
import TutorMascot from '../../../components/common/TutorMascot';
import './StudentDashboardPage.css';

const EMPTY_ENROLLMENTS = [];
const EMPTY_OVERVIEW = Object.freeze({ summary: {}, week: [], courses: [] });
const VISIBLE_COURSE_LIMIT = 8;
const DEFAULT_COURSE_NAME = 'Môn học đang tham gia';
const QUICK_CARD_TONES = ['blue', 'orange', 'green'];
const COURSE_CARD_TONES = [
  'sand',
  'sky',
  'mint',
  'peach',
  'plum',
  'teal',
  'indigo',
  'slate',
  'rose',
  'olive',
];
const QUICK_ACTIONS = [
  { icon: Bot, title: 'Hỏi AI Tutor', description: 'Học theo tài liệu môn học', tab: 'student-chat' },
  { icon: ClipboardCheck, title: 'Làm quiz', description: 'Luyện tập và kiểm tra nhanh', tab: 'student-quizzes' },
  { icon: BookOpen, title: 'Xem học liệu', description: 'Tài liệu do giảng viên chia sẻ', tab: 'student-materials' },
  { icon: FileCheck2, title: 'Làm bài tập', description: 'Xem đề và nộp bài theo hạn', tab: 'student-assignments' },
  { icon: MessageCircle, title: 'Hỏi giảng viên', description: 'Theo dõi yêu cầu hỗ trợ', tab: 'student-escalation' },
];

const getCourseCode = (item) => item?.courseId
  || item?.courseCode
  || item?.course?.courseId
  || item?.course?.id
  || '';

const getCourseName = (item) => item?.courseName
  || item?.courseTitle
  || item?.course?.name
  || DEFAULT_COURSE_NAME;

const getClassCode = (item) => item?.classCode
  || item?.classId
  || item?.classSection?.classCode
  || item?.classSection?.classId
  || '';

function buildCourseSummaries(enrollments) {
  const summaries = new Map();

  enrollments.forEach((enrollment) => {
    const id = getCourseCode(enrollment);
    if (!id) return;

    if (!summaries.has(id)) {
      summaries.set(id, {
        id,
        name: getCourseName(enrollment),
        enrollment,
        classes: new Set(),
      });
    }

    const classId = getClassCode(enrollment);
    if (classId) summaries.get(id).classes.add(classId);
  });

  return Array.from(summaries.values(), (course) => ({
    ...course,
    classes: Array.from(course.classes),
  }));
}

const waitForContextCommit = () => new Promise((resolve) => {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    globalThis.requestAnimationFrame(resolve);
    return;
  }
  globalThis.setTimeout(resolve, 0);
});

function DashboardEmptyState({ icon: Icon, title, description }) {
  return (
    <div className="student-dashboard-empty">
      {Icon && <Icon size={34} aria-hidden="true" />}
      <strong>{title}</strong>
      {description && <span>{description}</span>}
    </div>
  );
}

function CourseSearch({ query, onChange }) {
  return (
    <label className="student-dashboard-course-search">
      <Search size={20} aria-hidden="true" />
      <input
        type="search"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Tìm theo mã môn, tên môn hoặc lớp"
        aria-label="Tìm môn học"
      />
      {query && (
        <button type="button" onClick={() => onChange('')} aria-label="Xóa nội dung tìm kiếm">
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </label>
  );
}

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function displayCount(ready, value) {
  return ready ? (value ?? 0) : '—';
}

function displayPercent(ready, value) {
  if (!ready) return '—';
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number)}%` : 'Chưa có';
}

function fallbackWeek() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return {
      date: date.toISOString().slice(0, 10),
      label: WEEKDAY_LABELS[date.getDay()],
      active: false,
    };
  });
}

function CourseCard({ course, tone, stats, statsReady, isSelected, disabled, onOpen }) {
  return (
    <button
      type="button"
      className={`student-course-card is-${tone} ${isSelected ? 'is-selected' : ''}`}
      disabled={disabled}
      onClick={() => onOpen(course.enrollment)}
      aria-current={isSelected ? 'true' : undefined}
      aria-label={`Vào môn ${course.id} - ${course.name}`}
    >
      <span className="student-course-chips">
        <span className="student-course-chip">
          <MessageCircle size={13} aria-hidden="true" />
          {displayCount(statsReady, stats?.questionCount)} câu
        </span>
        <span className="student-course-chip">
          <ClipboardCheck size={13} aria-hidden="true" />
          {displayCount(statsReady, stats?.quizQuestionCount)} quiz
        </span>
        <span className="student-course-streak" title="Chuỗi ngày học liên tiếp">
          <Flame size={14} aria-hidden="true" />
          {displayCount(statsReady, stats?.streakDays)}
        </span>
      </span>
      <span className="student-course-book-icon" aria-hidden="true">
        <BookOpen size={28} />
      </span>
      <span className="student-course-code">{course.id}</span>
      <strong className={`student-course-name ${course.name === DEFAULT_COURSE_NAME ? 'is-fallback' : ''}`}>
        {course.name}
      </strong>
      <span className="student-course-footer">
        <span>
          {displayCount(statsReady, stats?.askCount)} lần hỏi
          {course.classes.length ? ` · Lớp ${course.classes.join(', ')}` : ''}
        </span>
        <ArrowRight size={16} aria-hidden="true" />
      </span>
    </button>
  );
}

function DashboardMetric({ icon: Icon, value, label, tone }) {
  return (
    <article className={`student-dashboard-metric is-${tone}`}>
      <span><Icon size={19} aria-hidden="true" /></span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}

function WeeklyActivityChart({ week, statsReady }) {
  const days = week?.length ? week : fallbackWeek();
  const maxValue = Math.max(
    1,
    ...days.map((day) => Math.max(
      Number(day.questionCount) || 0,
      Number(day.quizQuestionCount) || 0,
    )),
  );
  const hasActivity = days.some((day) => (Number(day.activityCount) || 0) > 0);

  return (
    <article className="student-activity-chart" aria-label="Biểu đồ hoạt động học tập 7 ngày">
      <header>
        <div>
          <span><BarChart3 size={14} aria-hidden="true" />7 ngày gần nhất</span>
          <h2>Hoạt động học tập</h2>
        </div>
        <div className="student-activity-chart__legend" aria-label="Chú thích">
          <span><i className="is-question" />Câu hỏi AI</span>
          <span><i className="is-quiz" />Câu quiz</span>
        </div>
      </header>
      <div className="student-activity-chart__plot">
        {days.map((day) => {
          const questions = Number(day.questionCount) || 0;
          const quizQuestions = Number(day.quizQuestionCount) || 0;
          return (
            <div
              className="student-activity-chart__day"
              key={day.date}
              title={`${day.label}: ${questions} câu hỏi AI, ${quizQuestions} câu quiz`}
            >
              <span className="student-activity-chart__bars">
                <i
                  className="is-question"
                  style={{ height: `${questions ? Math.max(8, (questions / maxValue) * 100) : 0}%` }}
                />
                <i
                  className="is-quiz"
                  style={{ height: `${quizQuestions ? Math.max(8, (quizQuestions / maxValue) * 100) : 0}%` }}
                />
              </span>
              <strong>{day.label}</strong>
            </div>
          );
        })}
        {statsReady && !hasActivity && (
          <p className="student-activity-chart__empty">Chưa có hoạt động trong 7 ngày gần đây.</p>
        )}
      </div>
    </article>
  );
}

function StudyStreak({ summary, week, statsReady }) {
  const streakDays = statsReady ? (summary?.streakDays ?? 0) : null;
  const days = week?.length ? week : fallbackWeek();
  return (
    <aside className="student-streak-card" aria-label="Chuỗi ngày học">
      <div className="student-streak-card__head">
        <div>
          <p>{streakDays > 0 ? `Chuỗi ${streakDays} ngày` : (statsReady ? 'Chưa có chuỗi học' : 'Đang tải chuỗi học')}</p>
          <strong>{displayCount(statsReady, summary?.studyDayCount)} ngày học</strong>
        </div>
        <span className="student-streak-flame">
          <Flame size={16} aria-hidden="true" />
          {displayCount(statsReady, streakDays)}
        </span>
      </div>
      <ol>
        {days.map((day) => (
          <li key={day.date} className={day.active ? 'is-active' : ''}>
            <span>{day.label}</span>
            <i />
          </li>
        ))}
      </ol>
    </aside>
  );
}

function QuickAction({ action, tone, disabled, isPending, onOpen }) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={isPending}
      className={`student-quick-card is-${tone}`}
      onClick={() => onOpen(action.tab)}
      title={action.description}
    >
      <span><Icon size={19} aria-hidden="true" /></span>
      <strong>{action.title}</strong>
    </button>
  );
}

export default function StudentDashboardPage({ currentUser, studentId, courseId, switchTab, triggerToast, enrollment }) {
  const enrollments = enrollment?.studentEnrollments || EMPTY_ENROLLMENTS;
  const [pendingTab, setPendingTab] = useState('');
  const [courseQuery, setCourseQuery] = useState('');
  const [showAllCourses, setShowAllCourses] = useState(false);
  const name = currentUser?.fullName || currentUser?.name || currentUser?.username || 'bạn';

  const courses = useMemo(() => buildCourseSummaries(enrollments), [enrollments]);
  const filteredCourses = useMemo(() => courses.filter((course) => (
    includesSearchText(`${course.id} ${course.name} ${course.classes.join(' ')}`, courseQuery)
  )), [courseQuery, courses]);
  const classCount = useMemo(
    () => new Set(enrollments.map(getClassCode).filter(Boolean)).size,
    [enrollments],
  );
  const isNavigating = Boolean(pendingTab);
  const overviewQuery = useQuery({
    queryKey: queryKeys.studentOverviewStats(studentId),
    queryFn: ({ signal }) => studentLearningApi.getOverviewStats(studentId, {
      signal,
      skipUnauthorizedRedirect: true,
    }),
    enabled: Boolean(studentId),
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 1,
  });
  const statsReady = overviewQuery.isSuccess;
  const overview = overviewQuery.data || EMPTY_OVERVIEW;
  const summary = overview.summary || EMPTY_OVERVIEW.summary;
  const statsByCourse = useMemo(() => {
    const map = new Map();
    (overview.courses || []).forEach((item) => {
      const id = String(item?.courseId || '').toUpperCase();
      if (id) map.set(id, item);
    });
    return map;
  }, [overview.courses]);

  const openDestination = async (tab, item) => {
    if (isNavigating) return;
    setPendingTab(tab);
    try {
      const context = await enrollment?.ensureEnrollmentContext?.(getCourseCode(item) || courseId);
      if (!context) {
        triggerToast?.('Chưa tìm thấy lớp học đã ghi danh. Hãy tải lại hoặc liên hệ quản trị viên.');
        return;
      }
      await waitForContextCommit();
      switchTab?.(tab);
    } finally {
      setPendingTab('');
    }
  };

  const renderCourses = () => {
    if (enrollment?.isStudentEnrollmentsLoading) {
      return (
        <div className="student-course-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="student-course-card student-course-card--skeleton" aria-hidden="true">
              <span className="skeleton-line" style={{ width: '40%', height: 14 }} />
              <span className="skeleton-line" style={{ width: '80%', height: 18 }} />
              <span className="skeleton-line" style={{ width: '55%', height: 13 }} />
            </div>
          ))}
        </div>
      );
    }
    if (filteredCourses.length) {
      const hiddenCount = Math.max(0, filteredCourses.length - VISIBLE_COURSE_LIMIT);
      const visibleCourses = showAllCourses ? filteredCourses : filteredCourses.slice(0, VISIBLE_COURSE_LIMIT);
      return (
        <>
          <div className="student-course-grid">
            {visibleCourses.map((course, index) => (
              <CourseCard
                key={course.id}
                course={course}
                tone={COURSE_CARD_TONES[index % COURSE_CARD_TONES.length]}
                stats={statsByCourse.get(String(course.id || '').toUpperCase())}
                statsReady={statsReady}
                isSelected={course.id === courseId}
                disabled={isNavigating}
                onOpen={(item) => openDestination('student-chat', item)}
              />
            ))}
          </div>
          {hiddenCount > 0 && (
            <button
              type="button"
              className="student-course-more"
              onClick={() => setShowAllCourses((value) => !value)}
              aria-expanded={showAllCourses}
            >
              {showAllCourses ? 'Thu gọn' : `Xem thêm ${hiddenCount} môn`}
            </button>
          )}
        </>
      );
    }
    if (courses.length) {
      return (
        <DashboardEmptyState
          icon={Search}
          title="Không tìm thấy môn học phù hợp"
          description="Hãy thử mã môn, tên môn hoặc mã lớp khác."
        />
      );
    }
    return (
      <DashboardEmptyState
        icon={GraduationCap}
        title="Chưa tìm thấy môn học đang tham gia"
        description="Danh sách sẽ xuất hiện khi dữ liệu ghi danh được đồng bộ."
      />
    );
  };

  return (
    <main className="student-dashboard">
      <section className="student-dashboard-hero" aria-label="Tổng quan học tập">
        <div>
          <h1>Chào {name}</h1>
          <p>Chọn môn và tiếp tục học cùng AI Tutor.</p>
          <ul className="student-dashboard-stats">
            <li><GraduationCap size={15} aria-hidden="true" /><strong>{courses.length}</strong> môn</li>
            <li><Layers3 size={15} aria-hidden="true" /><strong>{classCount}</strong> lớp</li>
            <li><BookOpen size={15} aria-hidden="true" />Đang chọn <strong>{courseId || '—'}</strong></li>
            <li><MessageCircle size={15} aria-hidden="true" /><strong>{displayCount(statsReady, summary.questionCount)}</strong> câu đã hỏi</li>
            <li><ClipboardCheck size={15} aria-hidden="true" /><strong>{displayCount(statsReady, summary.quizQuestionCount)}</strong> câu quiz</li>
          </ul>
        </div>
        <div className="student-dashboard-hero__side">
          <StudyStreak summary={summary} week={overview.week} statsReady={statsReady} />
          <TutorMascot size="md" className="student-dashboard-mascot" alt="Linh vật FPT University AI Tutor" />
          <button
            type="button"
            disabled={isNavigating}
            aria-busy={pendingTab === 'student-chat'}
            onClick={() => openDestination('student-chat')}
          >
            Học với AI <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <nav className="student-quick-grid" aria-label="Truy cập nhanh">
        {QUICK_ACTIONS.map((action, index) => (
          <QuickAction
            key={action.tab}
            action={action}
            tone={QUICK_CARD_TONES[index % QUICK_CARD_TONES.length]}
            disabled={isNavigating}
            isPending={pendingTab === action.tab}
            onOpen={openDestination}
          />
        ))}
      </nav>

      <section className="student-dashboard-insights" aria-label="Số liệu và biểu đồ học tập">
        <div className="student-dashboard-metric-grid">
          <DashboardMetric
            icon={MessageCircle}
            value={displayCount(statsReady, summary.askCount)}
            label="Phiên hỏi AI"
            tone="blue"
          />
          <DashboardMetric
            icon={ClipboardCheck}
            value={displayCount(statsReady, summary.quizAttemptCount)}
            label="Lượt làm quiz"
            tone="orange"
          />
          <DashboardMetric
            icon={CircleGauge}
            value={displayPercent(statsReady, summary.averageQuizPercent)}
            label="Điểm quiz trung bình"
            tone="green"
          />
          <DashboardMetric
            icon={GraduationCap}
            value={displayCount(statsReady, summary.activeCourseCount)}
            label="Môn đã hoạt động"
            tone="purple"
          />
        </div>
        <WeeklyActivityChart week={overview.week} statsReady={statsReady} />
      </section>

      <section className="student-dashboard-section student-dashboard-courses">
        <header className="student-dashboard-heading">
          <h2>Môn học của tôi{courses.length > 0 ? ` (${courses.length})` : ''}</h2>
          {courses.length > VISIBLE_COURSE_LIMIT / 2 && (
            <CourseSearch query={courseQuery} onChange={setCourseQuery} />
          )}
        </header>
        {renderCourses()}
      </section>
    </main>
  );
}

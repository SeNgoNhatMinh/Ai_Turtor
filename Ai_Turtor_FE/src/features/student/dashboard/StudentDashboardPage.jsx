import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Bot,
  ClipboardCheck,
  GraduationCap,
  Layers3,
  MessageCircle,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { includesSearchText } from '../../../utils/searchText';
import LiveNowBanner from '../../live-lessons/LiveNowBanner';
import './StudentDashboardPage.css';

const EMPTY_ENROLLMENTS = [];
const QUICK_ACTIONS = [
  { icon: Bot, title: 'Hỏi AI Tutor', description: 'Học theo tài liệu môn học', tab: 'student-chat', tone: 'blue' },
  { icon: ClipboardCheck, title: 'Làm quiz', description: 'Luyện tập và kiểm tra nhanh', tab: 'student-quizzes', tone: 'orange' },
  { icon: BookOpen, title: 'Xem học liệu', description: 'Tài liệu và bài tập môn học', tab: 'student-materials', tone: 'green' },
  { icon: MessageCircle, title: 'Hỏi giảng viên', description: 'Theo dõi yêu cầu hỗ trợ', tab: 'student-escalation', tone: 'purple' },
];

const getCourseCode = (item) => item?.courseId
  || item?.courseCode
  || item?.course?.courseId
  || item?.course?.id
  || '';

const getCourseName = (item) => item?.courseName
  || item?.courseTitle
  || item?.course?.name
  || 'Môn học đang tham gia';

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

function CourseCard({ course, index, disabled, onOpen }) {
  return (
    <article className={`student-course-card course-tone-${index % 4}`}>
      <div className="student-course-top">
        <span>{course.id}</span>
        <small>Đang học</small>
      </div>
      <div className="student-course-icon"><BookOpen size={25} aria-hidden="true" /></div>
      <h3>{course.name}</h3>
      <p>{course.classes.length ? `Lớp ${course.classes.join(', ')}` : 'Đã ghi danh vào môn học'}</p>
      <button type="button" disabled={disabled} onClick={() => onOpen(course.enrollment)}>
        Vào môn học <ArrowRight size={17} aria-hidden="true" />
      </button>
    </article>
  );
}

function QuickAction({ action, disabled, isPending, onOpen }) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={isPending}
      className={`student-quick-card ${action.tone}`}
      onClick={() => onOpen(action.tab)}
    >
      <span><Icon size={21} aria-hidden="true" /></span>
      <div><strong>{action.title}</strong><small>{action.description}</small></div>
      <ArrowRight size={17} aria-hidden="true" />
    </button>
  );
}

export default function StudentDashboardPage({ currentUser, courseId, classId, switchTab, triggerToast, enrollment }) {
  const enrollments = enrollment?.studentEnrollments || EMPTY_ENROLLMENTS;
  const [pendingTab, setPendingTab] = useState('');
  const [courseQuery, setCourseQuery] = useState('');
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
      return <DashboardEmptyState title="Đang tải danh sách môn học..." />;
    }
    if (filteredCourses.length) {
      return (
        <div className="student-course-grid">
          {filteredCourses.map((course, index) => (
            <CourseCard
              key={course.id}
              course={course}
              index={index}
              disabled={isNavigating}
              onOpen={(item) => openDestination('student-chat', item)}
            />
          ))}
        </div>
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
      <section className="student-dashboard-hero">
        <div>
          <span className="student-dashboard-eyebrow"><Sparkles size={15} /> Không gian học tập của bạn</span>
          <h1>Chào {name}, hôm nay mình học gì?</h1>
          <p>Theo dõi các môn đang tham gia và tiếp tục buổi học chỉ trong một chạm.</p>
          <button
            type="button"
            disabled={isNavigating}
            aria-busy={pendingTab === 'student-chat'}
            onClick={() => openDestination('student-chat')}
          >
            Bắt đầu học với AI <ArrowRight size={18} />
          </button>
        </div>
        <img src="/favicon.jpg" alt="Linh vật FPT University AI Tutor" />
      </section>

      <LiveNowBanner courseId={courseId} classId={classId} />

      <section className="student-dashboard-stats" aria-label="Tổng quan học tập">
        <article><span><GraduationCap size={21} /></span><div><strong>{courses.length}</strong><small>Môn đang học</small></div></article>
        <article><span><Layers3 size={21} /></span><div><strong>{classCount}</strong><small>Lớp đang tham gia</small></div></article>
        <article><span><BookOpen size={21} /></span><div><strong>{courseId || '—'}</strong><small>Môn đang chọn</small></div></article>
      </section>

      <div className="student-dashboard-content-grid">
        <section className="student-dashboard-section student-dashboard-courses">
          <header className="student-dashboard-heading">
            <div><span>Môn học của tôi</span><h2>Tiếp tục hành trình học tập</h2></div>
            <button type="button" onClick={() => switchTab?.('student-materials')}>
              Xem học liệu <ArrowRight size={16} />
            </button>
          </header>
          {courses.length > 0 && <CourseSearch query={courseQuery} onChange={setCourseQuery} />}
          {renderCourses()}
        </section>

        <section className="student-dashboard-section student-dashboard-actions">
          <header className="student-dashboard-heading">
            <div><span>Truy cập nhanh</span><h2>Bạn muốn làm gì tiếp theo?</h2></div>
          </header>
          <div className="student-quick-grid">
            {QUICK_ACTIONS.map((action) => (
              <QuickAction
                key={action.tab}
                action={action}
                disabled={isNavigating}
                isPending={pendingTab === action.tab}
                onOpen={openDestination}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

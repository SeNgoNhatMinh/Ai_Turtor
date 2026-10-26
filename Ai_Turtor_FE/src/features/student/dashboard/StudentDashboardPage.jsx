import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Bot,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  Layers3,
  MessageCircle,
  Search,
  X,
} from 'lucide-react';
import { includesSearchText } from '../../../utils/searchText';
import TutorMascot from '../../../components/common/TutorMascot';
import './StudentDashboardPage.css';

const EMPTY_ENROLLMENTS = [];
const VISIBLE_COURSE_LIMIT = 8;
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

function CourseCard({ course, isSelected, disabled, onOpen }) {
  return (
    <button
      type="button"
      className={`student-course-card ${isSelected ? 'is-selected' : ''}`}
      disabled={disabled}
      onClick={() => onOpen(course.enrollment)}
      aria-current={isSelected ? 'true' : undefined}
      aria-label={`Vào môn ${course.id} - ${course.name}`}
    >
      <span className="student-course-top">
        <span className="student-course-code">{course.id}</span>
        {isSelected && <span className="student-course-badge">Đang chọn</span>}
      </span>
      <strong className="student-course-name">{course.name}</strong>
      <span className="student-course-footer">
        <span>{course.classes.length ? `Lớp ${course.classes.join(', ')}` : 'Đã ghi danh'}</span>
        <ArrowRight size={16} aria-hidden="true" />
      </span>
    </button>
  );
}

function QuickAction({ action, disabled, isPending, onOpen }) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={isPending}
      className="student-quick-card"
      onClick={() => onOpen(action.tab)}
      title={action.description}
    >
      <span><Icon size={19} aria-hidden="true" /></span>
      <strong>{action.title}</strong>
    </button>
  );
}

export default function StudentDashboardPage({ currentUser, courseId, switchTab, triggerToast, enrollment }) {
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
      const hiddenCount = Math.max(0, filteredCourses.length - VISIBLE_COURSE_LIMIT);
      const visibleCourses = showAllCourses ? filteredCourses : filteredCourses.slice(0, VISIBLE_COURSE_LIMIT);
      return (
        <>
          <div className="student-course-grid">
            {visibleCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
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
          </ul>
        </div>
        <div className="student-dashboard-hero__side">
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
        {QUICK_ACTIONS.map((action) => (
          <QuickAction
            key={action.tab}
            action={action}
            disabled={isNavigating}
            isPending={pendingTab === action.tab}
            onOpen={openDestination}
          />
        ))}
      </nav>

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
